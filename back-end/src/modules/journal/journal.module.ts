import { Module } from '@nestjs/common';
import { JournalController } from './journal.controller';
import { JournalRepository } from './journal.repository';
import { JournalLectureService } from './journal.service';

@Module({
  controllers: [JournalController],
  providers: [JournalRepository, JournalLectureService],
})
export class JournalLectureModule {}
