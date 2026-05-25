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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TranscribeController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscribeController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const transcribe_service_1 = require("./transcribe.service");
const database_service_1 = require("../database/database.service");
const fs = __importStar(require("fs"));
function formatTimestamp(ms, isSrt) {
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
let TranscribeController = TranscribeController_1 = class TranscribeController {
    transcribeService;
    dbService;
    logger = new common_1.Logger(TranscribeController_1.name);
    constructor(transcribeService, dbService) {
        this.transcribeService = transcribeService;
        this.dbService = dbService;
    }
    async uploadFile(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded or file exceeds the 2GB limit.');
        }
        try {
            this.logger.log(`Received file: ${file.originalname} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
            const id = await this.transcribeService.startTranscription(file.path, file.originalname);
            if (fs.existsSync(file.path)) {
                try {
                    fs.unlinkSync(file.path);
                }
                catch (e) {
                    this.logger.error(`Failed to delete raw uploaded file: ${file.path}`, e);
                }
            }
            return { success: true, id };
        }
        catch (error) {
            if (file && fs.existsSync(file.path)) {
                try {
                    fs.unlinkSync(file.path);
                }
                catch (e) {
                    this.logger.error(`Cleanup of failed upload file failed: ${file.path}`, e);
                }
            }
            const message = error instanceof Error
                ? error.message
                : 'Failed to start transcription.';
            this.logger.error('Transcription start failed', error);
            throw new common_1.BadRequestException(message);
        }
    }
    getHistory() {
        return this.dbService.getTranscripts();
    }
    async getStatus(id) {
        try {
            return await this.transcribeService.checkStatusAndProcess(id);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Transcript not found.';
            throw new common_1.NotFoundException(message);
        }
    }
    deleteRecord(id) {
        this.dbService.deleteTranscript(id);
        return { success: true };
    }
    renameSpeaker(body) {
        const { id, speaker, name } = body;
        if (!id || !speaker || name === undefined) {
            throw new common_1.BadRequestException('Missing required fields: id, speaker, name');
        }
        const record = this.dbService.getTranscript(id);
        if (!record) {
            throw new common_1.NotFoundException('Transcript not found');
        }
        const speakerNames = record.speakerNames || {};
        speakerNames[speaker] = name.trim();
        record.speakerNames = speakerNames;
        this.dbService.saveTranscript(record);
        return record;
    }
    exportTranscript(id, format, res) {
        const record = this.dbService.getTranscript(id);
        if (!record) {
            throw new common_1.NotFoundException('Transcript not found');
        }
        const selectedFormat = (format || 'txt').toLowerCase();
        const safeTitle = record.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const getSpeakerName = (sp) => {
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
                }
                else {
                    content += `${startStr} --> ${endStr}\n<v ${speaker}>${speaker}: ${u.text}\n\n`;
                }
            });
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.${selectedFormat}"`);
            return res.send(content);
        }
        else if (selectedFormat === 'txt') {
            let content = `${record.title}\nTranscription - Created on ${new Date(record.createdAt).toLocaleDateString()}\n\n`;
            const utterances = record.utterances || [];
            utterances.forEach((u) => {
                const startStr = formatTimestamp(u.start, false).split('.')[0];
                const speaker = getSpeakerName(u.speaker);
                content += `[${startStr}] ${speaker}: ${u.text}\n\n`;
            });
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.txt"`);
            return res.send(content);
        }
        else {
            throw new common_1.BadRequestException('Unsupported export format. Use srt, vtt, or txt.');
        }
    }
};
exports.TranscribeController = TranscribeController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        dest: './uploads',
        limits: { fileSize: 2 * 1024 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TranscribeController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Get)('history'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TranscribeController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)('status/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TranscribeController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Delete)('history/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TranscribeController.prototype, "deleteRecord", null);
__decorate([
    (0, common_1.Post)('rename-speaker'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TranscribeController.prototype, "renameSpeaker", null);
__decorate([
    (0, common_1.Get)('export/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], TranscribeController.prototype, "exportTranscript", null);
exports.TranscribeController = TranscribeController = TranscribeController_1 = __decorate([
    (0, common_1.Controller)('transcribe'),
    __metadata("design:paramtypes", [transcribe_service_1.TranscribeService,
        database_service_1.DatabaseService])
], TranscribeController);
//# sourceMappingURL=transcribe.controller.js.map