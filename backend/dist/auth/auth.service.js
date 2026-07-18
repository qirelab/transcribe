"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcryptjs_1 = require("bcryptjs");
const crypto_1 = require("crypto");
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
        const user = {
            id: (0, crypto_1.randomUUID)(),
            email,
            passwordHash: await (0, bcryptjs_1.hash)(password, 12),
            emailVerified: true,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        };
        this.database.saveUser(user);
    }
    async resendVerification(rawEmail) {
        const email = this.normalizeEmail(rawEmail);
        const user = this.database.findUserByEmail(email);
        if (!user)
            return;
    }
    verifyEmail(token) {
        void token;
        throw new common_1.UnauthorizedException('Email verification is disabled');
    }
    async login(rawEmail, password) {
        const email = this.normalizeEmail(rawEmail);
        const user = this.database.findUserByEmail(email);
        if (!user || !(await (0, bcryptjs_1.compare)(password, user.passwordHash))) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const authUser = this.toAuthUser(user);
        return {
            user: authUser,
            token: await this.jwtService.signAsync(authUser),
        };
    }
    getUser(id) {
        const user = this.database.findUserById(id);
        if (!user) {
            throw new common_1.UnauthorizedException('User no longer exists');
        }
        return this.toAuthUser(user);
    }
    normalizeEmail(email) {
        return email.trim().toLowerCase();
    }
    toAuthUser(user) {
        return { id: user.id, email: user.email };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map