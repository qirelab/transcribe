import { TranscribeService } from './transcribe.service';
import { DatabaseService } from '../database/database.service';
import type { Response } from 'express';
export declare class TranscribeController {
    private readonly transcribeService;
    private readonly dbService;
    private readonly logger;
    constructor(transcribeService: TranscribeService, dbService: DatabaseService);
    uploadFile(file: Express.Multer.File): Promise<{
        success: boolean;
        id: string;
    }>;
    getHistory(): import("../database/database.service").TranscriptRecord[];
    getStatus(id: string): Promise<import("../database/database.service").TranscriptRecord>;
    deleteRecord(id: string): {
        success: boolean;
    };
    getAudio(id: string, res: Response): Promise<void>;
    renameSpeaker(body: {
        id: string;
        speaker: string;
        name: string;
    }): import("../database/database.service").TranscriptRecord;
    exportTranscript(id: string, format: string, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
