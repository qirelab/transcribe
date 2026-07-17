import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('setup')
export class SetupController {
  constructor(private readonly dbService: DatabaseService) {}

  @Get('status')
  getStatus() {
    const key = this.dbService.getApiKey();
    return { hasApiKey: !!key && key.trim().length > 0 };
  }

  @Post('config')
  configure(@Body() body: { apiKey: string }) {
    if (!body || !body.apiKey || body.apiKey.trim().length === 0) {
      throw new BadRequestException('API key cannot be empty');
    }
    this.dbService.saveApiKey(body.apiKey.trim());
    return { success: true };
  }
}
