import { TranscribeService } from './transcribe.service';
import { DatabaseService } from '../database/database.service';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types';
export declare class TranscribeController {
    private readonly transcribeService;
    private readonly dbService;
    private readonly logger;
    constructor(transcribeService: TranscribeService, dbService: DatabaseService);
    uploadFile(file: Express.Multer.File, user: AuthUser): Promise<{
        success: boolean;
        id: string;
    }>;
    getHistory(user: AuthUser): import("../database/database.service").TranscriptRecord[];
    getStatus(id: string, user: AuthUser): Promise<import("../database/database.service").TranscriptRecord>;
    deleteRecord(id: string, user: AuthUser): {
        success: boolean;
    };
    getAudio(id: string, user: AuthUser, res: Response): void;
    renameSpeaker(body: {
        id: string;
        speaker: string;
        name: string;
    }, user: AuthUser): import("../database/database.service").TranscriptRecord;
    exportTranscript(id: string, format: string, user: AuthUser, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
