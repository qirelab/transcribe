import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
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
    const token = randomBytes(32).toString('hex');
    const user: UserRecord = {
      id: randomUUID(),
      email,
      passwordHash: await hash(password, 12),
      emailVerified: false,
      verificationTokenHash: this.hashToken(token),
      verificationTokenExpiresAt: new Date(
        now.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.database.saveUser(user);

    try {
      await this.sendVerificationEmail(user.email, token);
    } catch (error) {
      // Do not leave an unusable account that cannot be registered again.
      this.database.deleteUser(user.id);
      throw error;
    }
  }

  async resendVerification(rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const user = this.database.findUserByEmail(email);
    if (!user || user.emailVerified) return;

    const token = randomBytes(32).toString('hex');
    user.verificationTokenHash = this.hashToken(token);
    user.verificationTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString();
    user.updatedAt = new Date().toISOString();
    this.database.saveUser(user);
    await this.sendVerificationEmail(user.email, token);
  }

  verifyEmail(token: string): AuthUser {
    const tokenHash = this.hashToken(token);
    const user = this.database
      .getUsers()
      .find((candidate) => candidate.verificationTokenHash === tokenHash);
    if (
      !user ||
      !user.verificationTokenExpiresAt ||
      new Date(user.verificationTokenExpiresAt).getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(
        'Verification link is invalid or expired',
      );
    }

    user.emailVerified = true;
    delete user.verificationTokenHash;
    delete user.verificationTokenExpiresAt;
    user.updatedAt = new Date().toISOString();
    this.database.saveUser(user);
    return this.toAuthUser(user);
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
    if (!user.emailVerified) {
      throw new ForbiddenException('Email address has not been verified');
    }

    const authUser = this.toAuthUser(user);
    return {
      user: authUser,
      token: await this.jwtService.signAsync(authUser),
    };
  }

  getUser(id: string): AuthUser {
    const user = this.database.findUserById(id);
    if (!user || !user.emailVerified) {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.toAuthUser(user);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthUser(user: UserRecord): AuthUser {
    return { id: user.id, email: user.email };
  }

  private async sendVerificationEmail(
    email: string,
    token: string,
  ): Promise<void> {
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
    const frontendUrl = (
      process.env.FRONTEND_URL ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const verificationUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Verify your Transcribe account',
      text: `Confirm your email address by opening this link: ${verificationUrl}`,
      html: `<p>Confirm your email address to use Transcribe:</p><p><a href="${verificationUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    });
  }
}
