import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface TranscriptRecord {
  id: string;
  userId: string;
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

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationTokenHash?: string;
  verificationTokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly dbPath = path.join(this.dataDir, 'transcripts.json');
  private readonly configPath = path.join(this.dataDir, 'config.json');
  private readonly usersPath = path.join(this.dataDir, 'users.json');

  onModuleInit() {
    this.ensureDataDirectory();
    this.removeLegacyTranscripts();
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
    if (!fs.existsSync(this.usersPath)) {
      this.writeJson(this.usersPath, []);
    }
  }

  private writeJson(filePath: string, value: unknown): void {
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temporaryPath, filePath);
  }

  private removeLegacyTranscripts(): void {
    const records = this.readTranscripts();
    const legacy = records.filter((record) => !record.userId);
    if (legacy.length === 0) return;

    const uploadsDir = path.join(process.cwd(), 'uploads');
    for (const record of legacy) {
      if (!fs.existsSync(uploadsDir)) break;
      for (const file of fs.readdirSync(uploadsDir)) {
        if (file.startsWith(record.id)) {
          fs.unlinkSync(path.join(uploadsDir, file));
        }
      }
    }
    this.writeJson(
      this.dbPath,
      records.filter((record) => !!record.userId),
    );
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
    this.writeJson(this.configPath, config);
  }

  private readTranscripts(): TranscriptRecord[] {
    try {
      this.ensureDataDirectory();
      const content = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(content) as TranscriptRecord[];
    } catch {
      return [];
    }
  }

  getTranscripts(userId: string): TranscriptRecord[] {
    return this.readTranscripts().filter((item) => item.userId === userId);
  }

  getTranscript(id: string, userId: string): TranscriptRecord | undefined {
    return this.readTranscripts().find(
      (item) => item.id === id && item.userId === userId,
    );
  }

  saveTranscript(record: TranscriptRecord): void {
    this.ensureDataDirectory();
    const list = this.readTranscripts();
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

    this.writeJson(this.dbPath, list);
  }

  deleteTranscript(id: string, userId: string): boolean {
    this.ensureDataDirectory();
    const list = this.readTranscripts();
    const filtered = list.filter(
      (item) => item.id !== id || item.userId !== userId,
    );
    if (filtered.length === list.length) return false;
    this.writeJson(this.dbPath, filtered);
    return true;
  }

  getUsers(): UserRecord[] {
    try {
      this.ensureDataDirectory();
      return JSON.parse(
        fs.readFileSync(this.usersPath, 'utf8'),
      ) as UserRecord[];
    } catch {
      return [];
    }
  }

  findUserByEmail(email: string): UserRecord | undefined {
    return this.getUsers().find((user) => user.email === email.toLowerCase());
  }

  findUserById(id: string): UserRecord | undefined {
    return this.getUsers().find((user) => user.id === id);
  }

  saveUser(user: UserRecord): void {
    const users = this.getUsers();
    const index = users.findIndex((item) => item.id === user.id);
    if (index >= 0) users[index] = user;
    else users.push(user);
    this.writeJson(this.usersPath, users);
  }

  deleteUser(id: string): void {
    this.writeJson(
      this.usersPath,
      this.getUsers().filter((user) => user.id !== id),
    );
  }
}
