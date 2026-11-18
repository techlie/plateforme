import { Module } from '@nestjs/common';
import { DocumentsModule } from '../../shared/documents/documents.module';
import { ReferentielsController } from './referentiels.controller';
import { ReferentielsRepository } from './referentiels.repository';
import { ReferentielsService } from './referentiels.service';

@Module({
  imports: [DocumentsModule],
  controllers: [ReferentielsController],
  providers: [ReferentielsRepository, ReferentielsService],
  exports: [ReferentielsService],
})
export class ReferentielsModule {}
