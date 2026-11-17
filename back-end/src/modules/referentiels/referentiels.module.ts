import { Module } from '@nestjs/common';
import { ReferentielsController } from './referentiels.controller';
import { ReferentielsRepository } from './referentiels.repository';
import { ReferentielsService } from './referentiels.service';

@Module({
  controllers: [ReferentielsController],
  providers: [ReferentielsRepository, ReferentielsService],
  exports: [ReferentielsService],
})
export class ReferentielsModule {}
