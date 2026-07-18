import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DatabaseService, UserRecord } from '../database/database.service';
import type { AuthUser } from './auth.types';

@Injectable()
export class AuthService {
  private readonly defaultDomains = new Set(['f-suite.com', 'qirelab.com']);

  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  isEmailAllowed(rawEmail: string): boolean {
    const email = this.normalizeEmail(rawEmail);
    const domain = email.split('@')[1] ?? '';
    const additionalEmails = new Set(
      (process.env.ALLOWED_EMAILS ?? '')
        .split(',')
        .map((value) => this.normalizeEmail(value))
        .filter(Boolean),
    );
    return this.defaultDomains.has(domain) || additionalEmails.has(email);
  }

  async register(rawEmail: string, password: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    if (!this.isEmailAllowed(email)) {
      throw new ForbiddenException(
        'This email address is not allowed to access the service',
      );
    }
    if (this.database.findUserByEmail(email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      email,
      passwordHash: await hash(password, 12),
      emailVerified: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.database.saveUser(user);
  }

  async resendVerification(rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const user = this.database.findUserByEmail(email);
    if (!user) return;
  }

  verifyEmail(token: string): AuthUser {
    void token;
    throw new UnauthorizedException('Email verification is disabled');
  }

  async login(
    rawEmail: string,
    password: string,
  ): Promise<{
    user: AuthUser;
    token: string;
  }> {
    const email = this.normalizeEmail(rawEmail);
    const user = this.database.findUserByEmail(email);
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authUser = this.toAuthUser(user);
    return {
      user: authUser,
      token: await this.jwtService.signAsync(authUser),
    };
  }

  getUser(id: string): AuthUser {
    const user = this.database.findUserById(id);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.toAuthUser(user);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toAuthUser(user: UserRecord): AuthUser {
    return { id: user.id, email: user.email };
  }
}
