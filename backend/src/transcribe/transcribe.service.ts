import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  DatabaseService,
  TranscriptRecord,
} from '../database/database.service';
import { AssemblyAI } from 'assemblyai';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

@Injectable()
export class TranscribeService implements OnModuleDestroy {
  private readonly logger = new Logger(TranscribeService.name);
  private readonly tempFiles: string[] = [];

  constructor(private readonly dbService: DatabaseService) {}

  onModuleDestroy() {
    // Clean up temporary files on shutdown
    for (const file of this.tempFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          this.logger.error(`Failed to clean up temp file: ${file}`, e);
        }
      }
    }
  }

  private getClient(): AssemblyAI {
    const apiKey = this.dbService.getApiKey();
    if (!apiKey) {
      throw new Error(
        'AssemblyAI API Key is not configured. Please visit the setup screen.',
      );
    }
    return new AssemblyAI({ apiKey });
  }

  async isFfmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('ffmpeg -version', (error) => {
        resolve(!error);
      });
    });
  }

  async compressMedia(inputPath: string): Promise<string> {
    const isAvailable = await this.isFfmpegAvailable();
    if (!isAvailable) {
      this.logger.warn(
        'ffmpeg is not available. Uploading original file directly.',
      );
      return inputPath;
    }

    const ext = path.extname(inputPath).toLowerCase();
    // If it's already a very lightweight mp3, we don't need to compress it
    if (ext === '.mp3') {
      const stats = fs.statSync(inputPath);
      if (stats.size < 20 * 1024 * 1024) {
        // < 20MB
        return inputPath;
      }
    }

    const outputPath = path.join(
      path.dirname(inputPath),
      `compressed-${Date.now()}-${path.basename(inputPath, ext)}.mp3`,
    );

    this.logger.log(
      `Extracting and compressing audio track using ffmpeg: ${inputPath} -> ${outputPath}`,
    );

    interface FfmpegCommand {
      noVideo(): FfmpegCommand;
      audioCodec(codec: string): FfmpegCommand;
      audioBitrate(bitrate: number): FfmpegCommand;
      toFormat(format: string): FfmpegCommand;
      on(event: string, callback: (...args: any[]) => void): FfmpegCommand;
      save(output: string): FfmpegCommand;
    }

    return new Promise((resolve) => {
      // Import fluent-ffmpeg dynamically to avoid failing if not configured properly
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ffmpeg = require('fluent-ffmpeg') as (
        file: string,
      ) => FfmpegCommand;
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(64)
        .toFormat('mp3')
        .on('end', () => {
          this.logger.log(
            `Audio compressed successfully. Size reduced from ${this.getFileSizeMb(inputPath)}MB to ${this.getFileSizeMb(outputPath)}MB.`,
          );
          this.tempFiles.push(outputPath);
          resolve(outputPath);
        })
        .on('error', (err: Error) => {
          this.logger.error(
            'ffmpeg compression failed, falling back to original file.',
            err,
          );
          resolve(inputPath);
        })
        .save(outputPath);
    });
  }

  private getFileSizeMb(filePath: string): string {
    const stats = fs.statSync(filePath);
    return (stats.size / (1024 * 1024)).toFixed(1);
  }

  async startTranscription(
    filePath: string,
    fileName: string,
  ): Promise<string> {
    const client = this.getClient();
    let fileToUpload = filePath;

    // Optional: run local compression
    try {
      fileToUpload = await this.compressMedia(filePath);
    } catch (e) {
      this.logger.error('Error during media compression', e);
      fileToUpload = filePath;
    }

    this.logger.log(`Uploading file to AssemblyAI: ${fileToUpload}`);
    const uploadUrl = await client.files.upload(fileToUpload);
    this.logger.log(`File uploaded successfully. URL: ${uploadUrl}`);

    this.logger.log(
      'Submitting transcription job with speaker diarization enabled.',
    );
    const transcript = await client.transcripts.submit({
      audio_url: uploadUrl,
      speaker_labels: true,
    });

    const record: TranscriptRecord = {
      id: transcript.id,
      title: fileName,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.dbService.saveTranscript(record);
    this.logger.log(`Transcription job submitted with ID: ${transcript.id}`);

    // Clean up temporary compressed file immediately after upload to conserve local storage
    if (fileToUpload !== filePath && fs.existsSync(fileToUpload)) {
      try {
        fs.unlinkSync(fileToUpload);
        const idx = this.tempFiles.indexOf(fileToUpload);
        if (idx >= 0) this.tempFiles.splice(idx, 1);
      } catch (err) {
        this.logger.error(
          `Error deleting temp compressed file: ${fileToUpload}`,
          err,
        );
      }
    }

    return transcript.id;
  }

  async checkStatusAndProcess(id: string): Promise<TranscriptRecord> {
    const record = this.dbService.getTranscript(id);
    if (!record) {
      throw new Error(`Transcript record with ID ${id} not found.`);
    }

    if (record.status === 'completed' || record.status === 'failed') {
      return record;
    }

    const client = this.getClient();
    this.logger.log(`Checking AssemblyAI transcript status for ID: ${id}`);
    const transcript = await client.transcripts.get(id);

    if (transcript.status === 'error') {
      record.status = 'failed';
      record.error = transcript.error || 'Unknown transcription error';
      this.dbService.saveTranscript(record);
      return record;
    }

    if (transcript.status === 'completed') {
      this.logger.log(
        `Transcription finished. Processing results for ID: ${id}`,
      );

      // Calculate basic audio properties
      record.duration = transcript.audio_duration
        ? Math.round(transcript.audio_duration)
        : 0;
      record.wordsCount = transcript.words ? transcript.words.length : 0;
      record.text = transcript.text || '';
      record.utterances = (transcript.utterances || []).map((u) => ({
        speaker: u.speaker,
        text: u.text,
        start: u.start,
        end: u.end,
      }));

      record.status = 'processing'; // Transition state while generating summaries
      this.dbService.saveTranscript(record);

      try {
        await this.generateAISummaryAndChapters(id, record);
        record.status = 'completed';
      } catch (e) {
        this.logger.error(`Failed to generate AI summaries for ID: ${id}`, e);
        // Still mark as completed so the user gets the raw transcript even if Lemur fails!
        record.status = 'completed';
        record.error =
          'Transcription completed, but AI summary generation failed.';
      }

      this.dbService.saveTranscript(record);
    } else {
      // Keep state in queued or processing
      record.status = transcript.status;
      this.dbService.saveTranscript(record);
    }

    return record;
  }

  private async generateAISummaryAndChapters(
    id: string,
    record: TranscriptRecord,
  ): Promise<void> {
    const client = this.getClient();
    this.logger.log(
      `Generating AI Executive Summary using Lemur for ID: ${id}`,
    );

    // 1. Generate Summary
    const summaryResponse = await client.lemur.task({
      transcript_ids: [id],
      prompt:
        'Provide a detailed executive summary of this transcript. Break it down into sections: "Executive Summary" (a brief overview), "Key Takeaways" (bulleted list of major points), and "Action Items" (numbered list of who does what). Format the output as clean markdown.',
      model: 'anthropic/claude-3-5-sonnet',
    } as any);
    record.summary = summaryResponse.response;

    // 2. Generate Chapters with timestamps
    this.logger.log(
      `Generating AI Chronological Chapters using Lemur for ID: ${id}`,
    );
    const chaptersResponse = await client.lemur.task({
      transcript_ids: [id],
      prompt: `Analyze this transcript and break it down into chronological chapters.
Each chapter represents a unified topic or segment of discussion.
Return a valid JSON array of objects with the exact keys: "start_time" (integer milliseconds), "end_time" (integer milliseconds), "headline" (string catchy topic name), "gist" (string short summary sentence), and "summary" (string brief explanation).
Make sure you estimate the timestamps based on the conversation flow.
Output ONLY the raw JSON array. Do not include markdown fences like \`\`\`json or explanatory text.`,
      model: 'anthropic/claude-3-5-sonnet',
    } as any);

    try {
      let cleanedJson = chaptersResponse.response.trim();
      // Strip markdown code fences if LLM included them
      if (cleanedJson.startsWith('```')) {
        cleanedJson = cleanedJson
          .replace(/^```(json)?/, '')
          .replace(/```$/, '')
          .trim();
      }
      interface RawChapter {
        start_time?: string | number;
        end_time?: string | number;
        headline?: string;
        gist?: string;
        summary?: string;
      }
      const chapters = JSON.parse(cleanedJson) as RawChapter[];
      record.chapters = chapters.map((c: RawChapter) => ({
        start: Number(c.start_time) || 0,
        end: Number(c.end_time) || 0,
        headline: c.headline || '',
        gist: c.gist || '',
        summary: c.summary || '',
      }));
    } catch (err) {
      this.logger.error(
        'Failed to parse AI chapter segments JSON, storing fallback chapter',
        err,
      );
      // Fallback single chapter covering the entire duration
      record.chapters = [
        {
          start: 0,
          end: (record.duration || 0) * 1000,
          headline: 'Full Recording',
          gist: 'The entire uploaded recording session.',
          summary: 'Could not generate detailed chapter breakdown.',
        },
      ];
    }
  }
}
