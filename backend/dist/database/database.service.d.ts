import { OnModuleInit } from '@nestjs/common';
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
export declare class DatabaseService implements OnModuleInit {
    private readonly dataDir;
    private readonly dbPath;
    private readonly configPath;
    private readonly usersPath;
    onModuleInit(): void;
    private ensureDataDirectory;
    private writeJson;
    private removeLegacyTranscripts;
    getApiKey(): string;
    saveApiKey(apiKey: string): void;
    private readTranscripts;
    getTranscripts(userId: string): TranscriptRecord[];
    getTranscript(id: string, userId: string): TranscriptRecord | undefined;
    saveTranscript(record: TranscriptRecord): void;
    deleteTranscript(id: string, userId: string): boolean;
    getUsers(): UserRecord[];
    findUserByEmail(email: string): UserRecord | undefined;
    findUserById(id: string): UserRecord | undefined;
    saveUser(user: UserRecord): void;
    deleteUser(id: string): void;
}
