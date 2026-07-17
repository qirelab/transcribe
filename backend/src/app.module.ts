import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { SetupModule } from './setup/setup.module';
import { TranscribeModule } from './transcribe/transcribe.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule, SetupModule, TranscribeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
