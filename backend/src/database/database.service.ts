import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface TranscriptRecord {
  id: string;
  title: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  duration?: number;
  wordsCount?: number;
  createdAt: string;
  updatedAt: string;
  text?: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  summary?: string;
  chapters?: Array<{
    start: number;
    end: number;
    headline: string;
    gist: string;
    summary: string;
  }>;
  speakerNames?: Record<string, string>;
}

export interface AppConfig {
  apiKey: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly dbPath = path.join(this.dataDir, 'transcripts.json');
  private readonly configPath = path.join(this.dataDir, 'config.json');

  onModuleInit() {
    this.ensureDataDirectory();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2), 'utf8');
    }
    if (!fs.existsSync(this.configPath)) {
      const defaultConfig: AppConfig = {
        apiKey: process.env.ASSEMBLYAI_API_KEY || '',
      };
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(defaultConfig, null, 2),
        'utf8',
      );
    }
  }

  getApiKey(): string {
    try {
      this.ensureDataDirectory();
      const content = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(content) as AppConfig;
      return config.apiKey || process.env.ASSEMBLYAI_API_KEY || '';
    } catch {
      return process.env.ASSEMBLYAI_API_KEY || '';
    }
  }

  saveApiKey(apiKey: string): void {
    this.ensureDataDirectory();
    const config: AppConfig = { apiKey };
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  getTranscripts(): TranscriptRecord[] {
    try {
      this.ensureDataDirectory();
      const content = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(content) as TranscriptRecord[];
    } catch {
      return [];
    }
  }

  getTranscript(id: string): TranscriptRecord | undefined {
    const list = this.getTranscripts();
    return list.find((item) => item.id === id);
  }

  saveTranscript(record: TranscriptRecord): void {
    this.ensureDataDirectory();
    const list = this.getTranscripts();
    const index = list.findIndex((item) => item.id === record.id);

    const updatedRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      list[index] = updatedRecord;
    } else {
      list.push(updatedRecord);
    }

    fs.writeFileSync(this.dbPath, JSON.stringify(list, null, 2), 'utf8');
  }

  deleteTranscript(id: string): void {
    this.ensureDataDirectory();
    const list = this.getTranscripts();
    const filtered = list.filter((item) => item.id !== id);
    fs.writeFileSync(this.dbPath, JSON.stringify(filtered, null, 2), 'utf8');
  }
}
