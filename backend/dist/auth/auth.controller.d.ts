import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import type { AuthUser } from './auth.types';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(body: RegisterDto): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyEmail(body: VerifyEmailDto): {
        success: boolean;
        user: AuthUser;
    };
    resendVerification(body: ResendVerificationDto): Promise<{
        success: boolean;
        message: string;
    }>;
    login(body: LoginDto, response: Response): Promise<{
        user: AuthUser;
    }>;
    logout(response: Response): {
        success: boolean;
    };
    me(user: AuthUser): {
        user: AuthUser;
    };
    private cookieOptions;
}
