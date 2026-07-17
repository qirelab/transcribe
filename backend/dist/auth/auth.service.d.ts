import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from './auth.types';
export declare class AuthService {
    private readonly database;
    private readonly jwtService;
    private readonly defaultDomains;
    constructor(database: DatabaseService, jwtService: JwtService);
    isEmailAllowed(rawEmail: string): boolean;
    register(rawEmail: string, password: string): Promise<void>;
    resendVerification(rawEmail: string): Promise<void>;
    verifyEmail(token: string): AuthUser;
    login(rawEmail: string, password: string): Promise<{
        user: AuthUser;
        token: string;
    }>;
    getUser(id: string): AuthUser;
    private normalizeEmail;
    private hashToken;
    private toAuthUser;
    private sendVerificationEmail;
}
