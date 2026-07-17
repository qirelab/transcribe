import type { Request } from 'express';
export interface AuthUser {
    id: string;
    email: string;
}
export interface AuthenticatedRequest extends Request {
    user: AuthUser;
    cookies: Record<string, string>;
}
export declare const AUTH_COOKIE_NAME = "transcribe_session";
export declare function getJwtSecret(): string;
