import { OnModuleDestroy } from '@nestjs/common';
import { DatabaseService, TranscriptRecord } from '../database/database.service';
export declare class TranscribeService implements OnModuleDestroy {
    private readonly dbService;
    private readonly logger;
    private readonly tempFiles;
    constructor(dbService: DatabaseService);
    onModuleDestroy(): void;
    private getClient;
    isFfmpegAvailable(): Promise<boolean>;
    compressMedia(inputPath: string): Promise<string>;
    private getFileSizeMb;
    startTranscription(filePath: string, fileName: string): Promise<string>;
    checkStatusAndProcess(id: string): Promise<TranscriptRecord>;
    private generateAISummaryAndChapters;
}
