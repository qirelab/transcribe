import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AUTH_COOKIE_NAME } from './auth.types';
import type { AuthUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    await this.authService.register(body.email, body.password);
    return {
      success: true,
      message: 'Check your email to verify your account',
    };
  }

  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailDto) {
    return { success: true, user: this.authService.verifyEmail(body.token) };
  }

  @Post('resend-verification')
  @HttpCode(200)
  async resendVerification(@Body() body: ResendVerificationDto) {
    await this.authService.resendVerification(body.email);
    return {
      success: true,
      message: 'If the account exists, a verification email was sent',
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);
    response.cookie(AUTH_COOKIE_NAME, result.token, this.cookieOptions());
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, this.cookieOptions(false));
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user: this.authService.getUser(user.id) };
  }

  private cookieOptions(includeMaxAge = true) {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: includeMaxAge ? 7 * 24 * 60 * 60 * 1000 : undefined,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    };
  }
}
