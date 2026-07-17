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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var TranscribeController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscribeController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const transcribe_service_1 = require("./transcribe.service");
const database_service_1 = require("../database/database.service");
const fs = __importStar(require("fs"));
const ExcelJS = __importStar(require("exceljs"));
const docx_1 = require("docx");
const pdfkit_1 = __importDefault(require("pdfkit"));
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/current-user.decorator");
function formatSimpleTimestamp(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const mm = String(minutes % 60).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    if (hours > 0) {
        const hh = String(hours).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
}
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
    async uploadFile(file, user) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded or file exceeds the 2GB limit.');
        }
        try {
            this.logger.log(`Received file: ${file.originalname} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
            const id = await this.transcribeService.startTranscription(file.path, file.originalname, user.id);
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
    getHistory(user) {
        return this.dbService.getTranscripts(user.id);
    }
    async getStatus(id, user) {
        try {
            return await this.transcribeService.checkStatusAndProcess(id, user.id);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Transcript not found.';
            throw new common_1.NotFoundException(message);
        }
    }
    deleteRecord(id, user) {
        if (!this.dbService.deleteTranscript(id, user.id)) {
            throw new common_1.NotFoundException('Transcript not found');
        }
        try {
            const filePath = this.transcribeService.getAudioFilePath(id);
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                this.logger.log(`Deleted corresponding audio file: ${filePath}`);
            }
        }
        catch (err) {
            this.logger.error(`Failed to delete corresponding audio file for transcript ${id}:`, err);
        }
        return { success: true };
    }
    getAudio(id, user, res) {
        if (!this.dbService.getTranscript(id, user.id)) {
            throw new common_1.NotFoundException('Audio file not found.');
        }
        const filePath = this.transcribeService.getAudioFilePath(id);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new common_1.NotFoundException('Audio file not found.');
        }
        return res.sendFile(filePath);
    }
    renameSpeaker(body, user) {
        const { id, speaker, name } = body;
        if (!id || !speaker || name === undefined) {
            throw new common_1.BadRequestException('Missing required fields: id, speaker, name');
        }
        const record = this.dbService.getTranscript(id, user.id);
        if (!record) {
            throw new common_1.NotFoundException('Transcript not found');
        }
        const speakerNames = record.speakerNames || {};
        speakerNames[speaker] = name.trim();
        record.speakerNames = speakerNames;
        this.dbService.saveTranscript(record);
        return record;
    }
    async exportTranscript(id, format, user, res) {
        const record = this.dbService.getTranscript(id, user.id);
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
        else if (selectedFormat === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Transcript');
            worksheet.columns = [
                { header: 'Start Time', key: 'start', width: 12 },
                { header: 'End Time', key: 'end', width: 12 },
                { header: 'Speaker', key: 'speaker', width: 18 },
                { header: 'Dialogue / Utterance', key: 'text', width: 65 },
            ];
            const headerRow = worksheet.getRow(1);
            headerRow.font = {
                name: 'Arial',
                size: 11,
                bold: true,
                color: { argb: 'FFFFFF' },
            };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '6366F1' },
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
            headerRow.height = 24;
            const utterances = record.utterances || [];
            utterances.forEach((u, idx) => {
                const row = worksheet.addRow({
                    start: formatSimpleTimestamp(u.start),
                    end: formatSimpleTimestamp(u.end),
                    speaker: getSpeakerName(u.speaker),
                    text: u.text,
                });
                if (idx % 2 === 1) {
                    row.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'F8FAFC' },
                    };
                }
                row.alignment = { vertical: 'middle', wrapText: true };
                row.font = { name: 'Arial', size: 10 };
            });
            worksheet.eachRow({ includeEmpty: false }, (row) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'E2E8F0' } },
                        left: { style: 'thin', color: { argb: 'E2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                        right: { style: 'thin', color: { argb: 'E2E8F0' } },
                    };
                });
            });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.xlsx"`);
            await workbook.xlsx.write(res);
            return res.end();
        }
        else if (selectedFormat === 'docx') {
            const utterances = record.utterances || [];
            const tableRows = [
                new docx_1.TableRow({
                    tableHeader: true,
                    children: [
                        new docx_1.TableCell({
                            width: { size: 15, type: docx_1.WidthType.PERCENTAGE },
                            shading: { fill: '6366F1' },
                            children: [
                                new docx_1.Paragraph({
                                    children: [
                                        new docx_1.TextRun({ text: 'Time', bold: true, color: 'FFFFFF' }),
                                    ],
                                }),
                            ],
                        }),
                        new docx_1.TableCell({
                            width: { size: 20, type: docx_1.WidthType.PERCENTAGE },
                            shading: { fill: '6366F1' },
                            children: [
                                new docx_1.Paragraph({
                                    children: [
                                        new docx_1.TextRun({
                                            text: 'Speaker',
                                            bold: true,
                                            color: 'FFFFFF',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                        new docx_1.TableCell({
                            width: { size: 65, type: docx_1.WidthType.PERCENTAGE },
                            shading: { fill: '6366F1' },
                            children: [
                                new docx_1.Paragraph({
                                    children: [
                                        new docx_1.TextRun({
                                            text: 'Dialogue / Utterance',
                                            bold: true,
                                            color: 'FFFFFF',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),
            ];
            utterances.forEach((u, idx) => {
                tableRows.push(new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            width: { size: 15, type: docx_1.WidthType.PERCENTAGE },
                            shading: idx % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
                            children: [
                                new docx_1.Paragraph({
                                    children: [
                                        new docx_1.TextRun({ text: formatSimpleTimestamp(u.start) }),
                                    ],
                                }),
                            ],
                        }),
                        new docx_1.TableCell({
                            width: { size: 20, type: docx_1.WidthType.PERCENTAGE },
                            shading: idx % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
                            children: [
                                new docx_1.Paragraph({
                                    children: [
                                        new docx_1.TextRun({
                                            text: getSpeakerName(u.speaker),
                                            bold: true,
                                        }),
                                    ],
                                }),
                            ],
                        }),
                        new docx_1.TableCell({
                            width: { size: 65, type: docx_1.WidthType.PERCENTAGE },
                            shading: idx % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
                            children: [
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: u.text })] }),
                            ],
                        }),
                    ],
                }));
            });
            const doc = new docx_1.Document({
                sections: [
                    {
                        properties: {},
                        children: [
                            new docx_1.Paragraph({
                                text: record.title,
                                heading: docx_1.HeadingLevel.HEADING_1,
                                spacing: { after: 200 },
                            }),
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: `Date: ${new Date(record.createdAt).toLocaleDateString()}`,
                                        italics: true,
                                    }),
                                ],
                                spacing: { after: 300 },
                            }),
                            new docx_1.Table({
                                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                                borders: {
                                    top: { style: docx_1.BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
                                    bottom: {
                                        style: docx_1.BorderStyle.SINGLE,
                                        size: 4,
                                        color: 'E2E8F0',
                                    },
                                    left: { style: docx_1.BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
                                    right: {
                                        style: docx_1.BorderStyle.SINGLE,
                                        size: 4,
                                        color: 'E2E8F0',
                                    },
                                    insideHorizontal: {
                                        style: docx_1.BorderStyle.SINGLE,
                                        size: 4,
                                        color: 'E2E8F0',
                                    },
                                    insideVertical: {
                                        style: docx_1.BorderStyle.SINGLE,
                                        size: 4,
                                        color: 'E2E8F0',
                                    },
                                },
                                rows: tableRows,
                            }),
                        ],
                    },
                ],
            });
            const buffer = await docx_1.Packer.toBuffer(doc);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.docx"`);
            return res.send(buffer);
        }
        else if (selectedFormat === 'pdf') {
            const doc = new pdfkit_1.default({ margin: 40, size: 'A4' });
            const regularFontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
            const boldFontPath = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
            if (fs.existsSync(regularFontPath)) {
                doc.registerFont('ArialRegular', regularFontPath);
                doc.font('ArialRegular');
            }
            else {
                doc.font('Helvetica');
            }
            if (fs.existsSync(boldFontPath)) {
                doc.registerFont('ArialBold', boldFontPath);
            }
            if (fs.existsSync(boldFontPath))
                doc.font('ArialBold');
            doc
                .fontSize(20)
                .fillColor('#1E1B4B')
                .text(record.title, { ellipsis: true });
            if (fs.existsSync(regularFontPath))
                doc.font('ArialRegular');
            doc
                .fontSize(10)
                .fillColor('#64748B')
                .text(`Date: ${new Date(record.createdAt).toLocaleDateString()}`);
            doc.moveDown(1.5);
            doc
                .strokeColor('#E2E8F0')
                .lineWidth(1)
                .moveTo(40, doc.y)
                .lineTo(555, doc.y)
                .stroke();
            doc.moveDown(1.5);
            const utterances = record.utterances || [];
            utterances.forEach((u) => {
                doc.save();
                const timeStr = `[${formatSimpleTimestamp(u.start)}]`;
                if (fs.existsSync(boldFontPath))
                    doc.font('ArialBold');
                doc
                    .fontSize(10)
                    .fillColor('#7C3AED')
                    .text(timeStr, { continued: true });
                doc
                    .fillColor('#0F172A')
                    .text(` ${getSpeakerName(u.speaker)}:`, { continued: true });
                if (fs.existsSync(regularFontPath))
                    doc.font('ArialRegular');
                doc.fillColor('#334155').text(` ${u.text}`);
                doc.restore();
                doc.moveDown(0.8);
            });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
            doc.pipe(res);
            doc.end();
        }
        else {
            throw new common_1.BadRequestException('Unsupported export format. Use srt, vtt, txt, xlsx, docx, or pdf.');
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
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TranscribeController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TranscribeController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)('status/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TranscribeController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Delete)('history/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TranscribeController.prototype, "deleteRecord", null);
__decorate([
    (0, common_1.Get)('audio/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], TranscribeController.prototype, "getAudio", null);
__decorate([
    (0, common_1.Post)('rename-speaker'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TranscribeController.prototype, "renameSpeaker", null);
__decorate([
    (0, common_1.Get)('export/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], TranscribeController.prototype, "exportTranscript", null);
exports.TranscribeController = TranscribeController = TranscribeController_1 = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('transcribe'),
    __metadata("design:paramtypes", [transcribe_service_1.TranscribeService,
        database_service_1.DatabaseService])
], TranscribeController);
//# sourceMappingURL=transcribe.controller.js.map