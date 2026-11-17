import { Module } from '@nestjs/common';
import { EntitesController } from './entites.controller';
import { EntitesRepository } from './entites.repository';
import { EntitesService } from './entites.service';

@Module({
  controllers: [EntitesController],
  providers: [EntitesRepository, EntitesService],
  exports: [EntitesService],
})
export class EntitesModule {}
