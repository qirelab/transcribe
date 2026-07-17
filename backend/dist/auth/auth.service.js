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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcryptjs_1 = require("bcryptjs");
const crypto_1 = require("crypto");
const nodemailer = __importStar(require("nodemailer"));
const database_service_1 = require("../database/database.service");
let AuthService = class AuthService {
    database;
    jwtService;
    defaultDomains = new Set(['f-suite.com', 'qirelab.com']);
    constructor(database, jwtService) {
        this.database = database;
        this.jwtService = jwtService;
    }
    isEmailAllowed(rawEmail) {
        const email = this.normalizeEmail(rawEmail);
        const domain = email.split('@')[1] ?? '';
        const additionalEmails = new Set((process.env.ALLOWED_EMAILS ?? '')
            .split(',')
            .map((value) => this.normalizeEmail(value))
            .filter(Boolean));
        return this.defaultDomains.has(domain) || additionalEmails.has(email);
    }
    async register(rawEmail, password) {
        const email = this.normalizeEmail(rawEmail);
        if (!this.isEmailAllowed(email)) {
            throw new common_1.ForbiddenException('This email address is not allowed to access the service');
        }
        if (this.database.findUserByEmail(email)) {
            throw new common_1.ConflictException('An account with this email already exists');
        }
        const now = new Date();
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const user = {
            id: (0, crypto_1.randomUUID)(),
            email,
            passwordHash: await (0, bcryptjs_1.hash)(password, 12),
            emailVerified: false,
            verificationTokenHash: this.hashToken(token),
            verificationTokenExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        };
        this.database.saveUser(user);
        try {
            await this.sendVerificationEmail(user.email, token);
        }
        catch (error) {
            this.database.deleteUser(user.id);
            throw error;
        }
    }
    async resendVerification(rawEmail) {
        const email = this.normalizeEmail(rawEmail);
        const user = this.database.findUserByEmail(email);
        if (!user || user.emailVerified)
            return;
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        user.verificationTokenHash = this.hashToken(token);
        user.verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        user.updatedAt = new Date().toISOString();
        this.database.saveUser(user);
        await this.sendVerificationEmail(user.email, token);
    }
    verifyEmail(token) {
        const tokenHash = this.hashToken(token);
        const user = this.database
            .getUsers()
            .find((candidate) => candidate.verificationTokenHash === tokenHash);
        if (!user ||
            !user.verificationTokenExpiresAt ||
            new Date(user.verificationTokenExpiresAt).getTime() <= Date.now()) {
            throw new common_1.UnauthorizedException('Verification link is invalid or expired');
        }
        user.emailVerified = true;
        delete user.verificationTokenHash;
        delete user.verificationTokenExpiresAt;
        user.updatedAt = new Date().toISOString();
        this.database.saveUser(user);
        return this.toAuthUser(user);
    }
    async login(rawEmail, password) {
        const email = this.normalizeEmail(rawEmail);
        const user = this.database.findUserByEmail(email);
        if (!user || !(await (0, bcryptjs_1.compare)(password, user.passwordHash))) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        if (!user.emailVerified) {
            throw new common_1.ForbiddenException('Email address has not been verified');
        }
        const authUser = this.toAuthUser(user);
        return {
            user: authUser,
            token: await this.jwtService.signAsync(authUser),
        };
    }
    getUser(id) {
        const user = this.database.findUserById(id);
        if (!user || !user.emailVerified) {
            throw new common_1.UnauthorizedException('User no longer exists');
        }
        return this.toAuthUser(user);
    }
    normalizeEmail(email) {
        return email.trim().toLowerCase();
    }
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    toAuthUser(user) {
        return { id: user.id, email: user.email };
    }
    async sendVerificationEmail(email, token) {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT ?? 587);
        const from = process.env.SMTP_FROM;
        if (!host || !from) {
            throw new Error('SMTP_HOST and SMTP_FROM must be configured');
        }
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER
                ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                }
                : undefined,
        });
        const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
        const verificationUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
        await transporter.sendMail({
            from,
            to: email,
            subject: 'Verify your Transcribe account',
            text: `Confirm your email address by opening this link: ${verificationUrl}`,
            html: `<p>Confirm your email address to use Transcribe:</p><p><a href="${verificationUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map