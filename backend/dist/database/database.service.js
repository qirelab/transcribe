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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let DatabaseService = class DatabaseService {
    dataDir = path.join(process.cwd(), 'data');
    dbPath = path.join(this.dataDir, 'transcripts.json');
    configPath = path.join(this.dataDir, 'config.json');
    onModuleInit() {
        this.ensureDataDirectory();
    }
    ensureDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2), 'utf8');
        }
        if (!fs.existsSync(this.configPath)) {
            const defaultConfig = {
                apiKey: process.env.ASSEMBLYAI_API_KEY || '',
            };
            fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
        }
    }
    getApiKey() {
        try {
            this.ensureDataDirectory();
            const content = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(content);
            return config.apiKey || process.env.ASSEMBLYAI_API_KEY || '';
        }
        catch {
            return process.env.ASSEMBLYAI_API_KEY || '';
        }
    }
    saveApiKey(apiKey) {
        this.ensureDataDirectory();
        const config = { apiKey };
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    }
    getTranscripts() {
        try {
            this.ensureDataDirectory();
            const content = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(content);
        }
        catch {
            return [];
        }
    }
    getTranscript(id) {
        const list = this.getTranscripts();
        return list.find((item) => item.id === id);
    }
    saveTranscript(record) {
        this.ensureDataDirectory();
        const list = this.getTranscripts();
        const index = list.findIndex((item) => item.id === record.id);
        const updatedRecord = {
            ...record,
            updatedAt: new Date().toISOString(),
        };
        if (index >= 0) {
            list[index] = updatedRecord;
        }
        else {
            list.push(updatedRecord);
        }
        fs.writeFileSync(this.dbPath, JSON.stringify(list, null, 2), 'utf8');
    }
    deleteTranscript(id) {
        this.ensureDataDirectory();
        const list = this.getTranscripts();
        const filtered = list.filter((item) => item.id !== id);
        fs.writeFileSync(this.dbPath, JSON.stringify(filtered, null, 2), 'utf8');
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = __decorate([
    (0, common_1.Injectable)()
], DatabaseService);
//# sourceMappingURL=database.service.js.map