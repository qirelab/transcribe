import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest, AuthUser } from './auth.types';
import { AUTH_COOKIE_NAME } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const bearer = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    const token = request.cookies?.[AUTH_COOKIE_NAME] || bearer;

    if (!token) throw new UnauthorizedException('Authentication required');

    try {
      request.user = await this.jwtService.verifyAsync<AuthUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
