"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TranscribeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscribeService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const assemblyai_1 = require("assemblyai");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
let TranscribeService = TranscribeService_1 = class TranscribeService {
    dbService;
    logger = new common_1.Logger(TranscribeService_1.name);
    tempFiles = [];
    constructor(dbService) {
        this.dbService = dbService;
    }
    onModuleDestroy() {
        for (const file of this.tempFiles) {
            if (fs.existsSync(file)) {
                try {
                    fs.unlinkSync(file);
                }
                catch (e) {
                    this.logger.error(`Failed to clean up temp file: ${file}`, e);
                }
            }
        }
    }
    getClient() {
        const apiKey = this.dbService.getApiKey();
        if (!apiKey) {
            throw new Error('AssemblyAI API Key is not configured. Please visit the setup screen.');
        }
        return new assemblyai_1.AssemblyAI({ apiKey });
    }
    async isFfmpegAvailable() {
        return new Promise((resolve) => {
            (0, child_process_1.exec)('ffmpeg -version', (error) => {
                resolve(!error);
            });
        });
    }
    async compressMedia(inputPath) {
        const isAvailable = await this.isFfmpegAvailable();
        if (!isAvailable) {
            this.logger.warn('ffmpeg is not available. Uploading original file directly.');
            return inputPath;
        }
        const ext = path.extname(inputPath).toLowerCase();
        if (ext === '.mp3') {
            const stats = fs.statSync(inputPath);
            if (stats.size < 20 * 1024 * 1024) {
                return inputPath;
            }
        }
        const outputPath = path.join(path.dirname(inputPath), `compressed-${Date.now()}-${path.basename(inputPath, ext)}.mp3`);
        this.logger.log(`Extracting and compressing audio track using ffmpeg: ${inputPath} -> ${outputPath}`);
        return new Promise((resolve) => {
            const ffmpeg = require('fluent-ffmpeg');
            ffmpeg(inputPath)
                .noVideo()
                .audioCodec('libmp3lame')
                .audioBitrate(64)
                .toFormat('mp3')
                .on('end', () => {
                this.logger.log(`Audio compressed successfully. Size reduced from ${this.getFileSizeMb(inputPath)}MB to ${this.getFileSizeMb(outputPath)}MB.`);
                this.tempFiles.push(outputPath);
                resolve(outputPath);
            })
                .on('error', (err) => {
                this.logger.error('ffmpeg compression failed, falling back to original file.', err);
                resolve(inputPath);
            })
                .save(outputPath);
        });
    }
    getFileSizeMb(filePath) {
        const stats = fs.statSync(filePath);
        return (stats.size / (1024 * 1024)).toFixed(1);
    }
    async startTranscription(filePath, fileName) {
        const client = this.getClient();
        let fileToUpload = filePath;
        try {
            fileToUpload = await this.compressMedia(filePath);
        }
        catch (e) {
            this.logger.error('Error during media compression', e);
            fileToUpload = filePath;
        }
        this.logger.log(`Uploading file to AssemblyAI: ${fileToUpload}`);
        const uploadUrl = await client.files.upload(fileToUpload);
        this.logger.log(`File uploaded successfully. URL: ${uploadUrl}`);
        this.logger.log('Submitting transcription job with speaker diarization enabled.');
        const transcript = await client.transcripts.submit({
            audio_url: uploadUrl,
            speaker_labels: true,
        });
        const record = {
            id: transcript.id,
            title: fileName,
            status: 'queued',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.dbService.saveTranscript(record);
        this.logger.log(`Transcription job submitted with ID: ${transcript.id}`);
        if (fileToUpload !== filePath && fs.existsSync(fileToUpload)) {
            try {
                fs.unlinkSync(fileToUpload);
                const idx = this.tempFiles.indexOf(fileToUpload);
                if (idx >= 0)
                    this.tempFiles.splice(idx, 1);
            }
            catch (err) {
                this.logger.error(`Error deleting temp compressed file: ${fileToUpload}`, err);
            }
        }
        return transcript.id;
    }
    async checkStatusAndProcess(id) {
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
            this.logger.log(`Transcription finished. Processing results for ID: ${id}`);
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
            record.status = 'processing';
            this.dbService.saveTranscript(record);
            try {
                await this.generateAISummaryAndChapters(id, record);
                record.status = 'completed';
            }
            catch (e) {
                this.logger.error(`Failed to generate AI summaries for ID: ${id}`, e);
                record.status = 'completed';
                record.error =
                    'Transcription completed, but AI summary generation failed.';
            }
            this.dbService.saveTranscript(record);
        }
        else {
            record.status = transcript.status;
            this.dbService.saveTranscript(record);
        }
        return record;
    }
    async generateAISummaryAndChapters(id, record) {
        const client = this.getClient();
        this.logger.log(`Generating AI Executive Summary using Lemur for ID: ${id}`);
        const summaryResponse = await client.lemur.task({
            transcript_ids: [id],
            prompt: 'Provide a detailed executive summary of this transcript. Break it down into sections: "Executive Summary" (a brief overview), "Key Takeaways" (bulleted list of major points), and "Action Items" (numbered list of who does what). Format the output as clean markdown.',
            model: 'anthropic/claude-3-5-sonnet',
        });
        record.summary = summaryResponse.response;
        this.logger.log(`Generating AI Chronological Chapters using Lemur for ID: ${id}`);
        const chaptersResponse = await client.lemur.task({
            transcript_ids: [id],
            prompt: `Analyze this transcript and break it down into chronological chapters.
Each chapter represents a unified topic or segment of discussion.
Return a valid JSON array of objects with the exact keys: "start_time" (integer milliseconds), "end_time" (integer milliseconds), "headline" (string catchy topic name), "gist" (string short summary sentence), and "summary" (string brief explanation).
Make sure you estimate the timestamps based on the conversation flow.
Output ONLY the raw JSON array. Do not include markdown fences like \`\`\`json or explanatory text.`,
            model: 'anthropic/claude-3-5-sonnet',
        });
        try {
            let cleanedJson = chaptersResponse.response.trim();
            if (cleanedJson.startsWith('```')) {
                cleanedJson = cleanedJson
                    .replace(/^```(json)?/, '')
                    .replace(/```$/, '')
                    .trim();
            }
            const chapters = JSON.parse(cleanedJson);
            record.chapters = chapters.map((c) => ({
                start: Number(c.start_time) || 0,
                end: Number(c.end_time) || 0,
                headline: c.headline || '',
                gist: c.gist || '',
                summary: c.summary || '',
            }));
        }
        catch (err) {
            this.logger.error('Failed to parse AI chapter segments JSON, storing fallback chapter', err);
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
};
exports.TranscribeService = TranscribeService;
exports.TranscribeService = TranscribeService = TranscribeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], TranscribeService);
//# sourceMappingURL=transcribe.service.js.map