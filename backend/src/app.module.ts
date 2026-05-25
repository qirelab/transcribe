import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { SetupModule } from './setup/setup.module';
import { TranscribeModule } from './transcribe/transcribe.module';

@Module({
  imports: [DatabaseModule, SetupModule, TranscribeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
