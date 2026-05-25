import { OnModuleInit } from '@nestjs/common';
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
export declare class DatabaseService implements OnModuleInit {
    private readonly dataDir;
    private readonly dbPath;
    private readonly configPath;
    onModuleInit(): void;
    private ensureDataDirectory;
    getApiKey(): string;
    saveApiKey(apiKey: string): void;
    getTranscripts(): TranscriptRecord[];
    getTranscript(id: string): TranscriptRecord | undefined;
    saveTranscript(record: TranscriptRecord): void;
    deleteTranscript(id: string): void;
}
