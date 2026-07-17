import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  cookies: Record<string, string>;
}

export const AUTH_COOKIE_NAME = 'transcribe_session';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return 'development-only-change-me';
}
