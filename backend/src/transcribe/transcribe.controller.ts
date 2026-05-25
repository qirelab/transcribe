import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TranscribeService } from './transcribe.service';
import { DatabaseService } from '../database/database.service';
import type { Response } from 'express';
import * as fs from 'fs';

// Helper function to format milliseconds to SRT/VTT timestamp
function formatTimestamp(ms: number, isSrt: boolean): string {
  const seconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const mmm = String(milliseconds).padStart(3, '0');

  const sep = isSrt ? ',' : '.';
  return `${hh}:${mm}:${ss}${sep}${mmm}`;
}

@Controller('transcribe')
export class TranscribeController {
  private readonly logger = new Logger(TranscribeController.name);

  constructor(
    private readonly transcribeService: TranscribeService,
    private readonly dbService: DatabaseService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: './uploads',
      limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB soft limit
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded or file exceeds the 2GB limit.',
      );
    }

    try {
      this.logger.log(
        `Received file: ${file.originalname} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
      );

      // Start async transcription job
      const id = await this.transcribeService.startTranscription(
        file.path,
        file.originalname,
      );

      // Clean up the original local upload file after submitting to AssemblyAI
      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          this.logger.error(
            `Failed to delete raw uploaded file: ${file.path}`,
            e,
          );
        }
      }

      return { success: true, id };
    } catch (error: unknown) {
      // Clean up file if there was an upload error
      if (file && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          this.logger.error(
            `Cleanup of failed upload file failed: ${file.path}`,
            e,
          );
        }
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start transcription.';
      this.logger.error('Transcription start failed', error);
      throw new BadRequestException(message);
    }
  }

  @Get('history')
  getHistory() {
    return this.dbService.getTranscripts();
  }

  @Get('status/:id')
  async getStatus(@Param('id') id: string) {
    try {
      return await this.transcribeService.checkStatusAndProcess(id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Transcript not found.';
      throw new NotFoundException(message);
    }
  }

  @Delete('history/:id')
  deleteRecord(@Param('id') id: string) {
    this.dbService.deleteTranscript(id);
    return { success: true };
  }

  @Post('rename-speaker')
  renameSpeaker(@Body() body: { id: string; speaker: string; name: string }) {
    const { id, speaker, name } = body;
    if (!id || !speaker || name === undefined) {
      throw new BadRequestException(
        'Missing required fields: id, speaker, name',
      );
    }

    const record = this.dbService.getTranscript(id);
    if (!record) {
      throw new NotFoundException('Transcript not found');
    }

    const speakerNames = record.speakerNames || {};
    speakerNames[speaker] = name.trim();
    record.speakerNames = speakerNames;

    this.dbService.saveTranscript(record);
    return record;
  }

  @Get('export/:id')
  exportTranscript(
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const record = this.dbService.getTranscript(id);
    if (!record) {
      throw new NotFoundException('Transcript not found');
    }

    const selectedFormat = (format || 'txt').toLowerCase();
    const safeTitle = record.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Map speaker ID (e.g. "A" or "1") to custom name, fallback to "Speaker A"
    const getSpeakerName = (sp: string) => {
      if (record.speakerNames && record.speakerNames[sp]) {
        return record.speakerNames[sp];
      }
      return `Speaker ${sp}`;
    };

    if (selectedFormat === 'vtt' || selectedFormat === 'srt') {
      const isSrt = selectedFormat === 'srt';
      let content = isSrt ? '' : 'WEBVTT\n\n';

      const utterances = record.utterances || [];
      utterances.forEach((u, index) => {
        const startStr = formatTimestamp(u.start, isSrt);
        const endStr = formatTimestamp(u.end, isSrt);
        const speaker = getSpeakerName(u.speaker);

        if (isSrt) {
          content += `${index + 1}\n${startStr} --> ${endStr}\n${speaker}: ${u.text}\n\n`;
        } else {
          content += `${startStr} --> ${endStr}\n<v ${speaker}>${speaker}: ${u.text}\n\n`;
        }
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeTitle}.${selectedFormat}"`,
      );
      return res.send(content);
    } else if (selectedFormat === 'txt') {
      let content = `${record.title}\nTranscription - Created on ${new Date(record.createdAt).toLocaleDateString()}\n\n`;

      const utterances = record.utterances || [];
      utterances.forEach((u) => {
        const startStr = formatTimestamp(u.start, false).split('.')[0]; // HH:MM:SS
        const speaker = getSpeakerName(u.speaker);
        content += `[${startStr}] ${speaker}: ${u.text}\n\n`;
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeTitle}.txt"`,
      );
      return res.send(content);
    } else {
      throw new BadRequestException(
        'Unsupported export format. Use srt, vtt, or txt.',
      );
    }
  }
}
