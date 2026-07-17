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
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TranscribeService } from './transcribe.service';
import { DatabaseService } from '../database/database.service';
import type { Response } from 'express';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TextRun,
  HeadingLevel,
} from 'docx';
import PDFDocument from 'pdfkit';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

// Helper function to format milliseconds to a simple clean timestamp (HH:MM:SS or MM:SS)
function formatSimpleTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const mm = String(minutes % 60).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

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

@UseGuards(JwtAuthGuard)
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
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
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
        user.id,
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
  getHistory(@CurrentUser() user: AuthUser) {
    return this.dbService.getTranscripts(user.id);
  }

  @Get('status/:id')
  async getStatus(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    try {
      return await this.transcribeService.checkStatusAndProcess(id, user.id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Transcript not found.';
      throw new NotFoundException(message);
    }
  }

  @Delete('history/:id')
  deleteRecord(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (!this.dbService.deleteTranscript(id, user.id)) {
      throw new NotFoundException('Transcript not found');
    }

    // Clean up corresponding audio file from uploads directory
    try {
      const filePath = this.transcribeService.getAudioFilePath(id);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted corresponding audio file: ${filePath}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to delete corresponding audio file for transcript ${id}:`,
        err,
      );
    }

    return { success: true };
  }

  @Get('audio/:id')
  getAudio(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    if (!this.dbService.getTranscript(id, user.id)) {
      throw new NotFoundException('Audio file not found.');
    }
    const filePath = this.transcribeService.getAudioFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException('Audio file not found.');
    }
    return res.sendFile(filePath);
  }

  @Post('rename-speaker')
  renameSpeaker(
    @Body() body: { id: string; speaker: string; name: string },
    @CurrentUser() user: AuthUser,
  ) {
    const { id, speaker, name } = body;
    if (!id || !speaker || name === undefined) {
      throw new BadRequestException(
        'Missing required fields: id, speaker, name',
      );
    }

    const record = this.dbService.getTranscript(id, user.id);
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
  async exportTranscript(
    @Param('id') id: string,
    @Query('format') format: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const record = this.dbService.getTranscript(id, user.id);
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
    } else if (selectedFormat === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Transcript');

      worksheet.columns = [
        { header: 'Start Time', key: 'start', width: 12 },
        { header: 'End Time', key: 'end', width: 12 },
        { header: 'Speaker', key: 'speaker', width: 18 },
        { header: 'Dialogue / Utterance', key: 'text', width: 65 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFF' },
      };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '6366F1' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
      headerRow.height = 24;

      const utterances = record.utterances || [];
      utterances.forEach((u, idx) => {
        const row = worksheet.addRow({
          start: formatSimpleTimestamp(u.start),
          end: formatSimpleTimestamp(u.end),
          speaker: getSpeakerName(u.speaker),
          text: u.text,
        });

        if (idx % 2 === 1) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F8FAFC' },
          };
        }

        row.alignment = { vertical: 'middle', wrapText: true };
        row.font = { name: 'Arial', size: 10 };
      });

      worksheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'E2E8F0' } },
            left: { style: 'thin', color: { argb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'E2E8F0' } },
          };
        });
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeTitle}.xlsx"`,
      );

      await workbook.xlsx.write(res);
      return res.end();
    } else if (selectedFormat === 'docx') {
      const utterances = record.utterances || [];

      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: { fill: '6366F1' },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Time', bold: true, color: 'FFFFFF' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: '6366F1' },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Speaker',
                      bold: true,
                      color: 'FFFFFF',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              shading: { fill: '6366F1' },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Dialogue / Utterance',
                      bold: true,
                      color: 'FFFFFF',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ];

      utterances.forEach((u, idx) => {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                shading: idx % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: formatSimpleTimestamp(u.start) }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                shading: idx % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: getSpeakerName(u.speaker),
                        bold: true,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 65, type: WidthType.PERCENTAGE },
                shading: idx % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
                children: [
                  new Paragraph({ children: [new TextRun({ text: u.text })] }),
                ],
              }),
            ],
          }),
        );
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: record.title,
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Date: ${new Date(record.createdAt).toLocaleDateString()}`,
                    italics: true,
                  }),
                ],
                spacing: { after: 300 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: 'E2E8F0',
                  },
                  left: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
                  right: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: 'E2E8F0',
                  },
                  insideHorizontal: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: 'E2E8F0',
                  },
                  insideVertical: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: 'E2E8F0',
                  },
                },
                rows: tableRows,
              }),
            ],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeTitle}.docx"`,
      );
      return res.send(buffer);
    } else if (selectedFormat === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });

      const regularFontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
      const boldFontPath = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';

      if (fs.existsSync(regularFontPath)) {
        doc.registerFont('ArialRegular', regularFontPath);
        doc.font('ArialRegular');
      } else {
        doc.font('Helvetica');
      }

      if (fs.existsSync(boldFontPath)) {
        doc.registerFont('ArialBold', boldFontPath);
      }

      if (fs.existsSync(boldFontPath)) doc.font('ArialBold');
      doc
        .fontSize(20)
        .fillColor('#1E1B4B')
        .text(record.title, { ellipsis: true });

      if (fs.existsSync(regularFontPath)) doc.font('ArialRegular');
      doc
        .fontSize(10)
        .fillColor('#64748B')
        .text(`Date: ${new Date(record.createdAt).toLocaleDateString()}`);
      doc.moveDown(1.5);

      doc
        .strokeColor('#E2E8F0')
        .lineWidth(1)
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke();
      doc.moveDown(1.5);

      const utterances = record.utterances || [];
      utterances.forEach((u) => {
        doc.save();

        const timeStr = `[${formatSimpleTimestamp(u.start)}]`;
        if (fs.existsSync(boldFontPath)) doc.font('ArialBold');
        doc
          .fontSize(10)
          .fillColor('#7C3AED')
          .text(timeStr, { continued: true });

        doc
          .fillColor('#0F172A')
          .text(` ${getSpeakerName(u.speaker)}:`, { continued: true });

        if (fs.existsSync(regularFontPath)) doc.font('ArialRegular');
        doc.fillColor('#334155').text(` ${u.text}`);

        doc.restore();
        doc.moveDown(0.8);
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeTitle}.pdf"`,
      );

      doc.pipe(res);
      doc.end();
    } else {
      throw new BadRequestException(
        'Unsupported export format. Use srt, vtt, txt, xlsx, docx, or pdf.',
      );
    }
  }
}
