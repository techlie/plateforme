import { Module } from '@nestjs/common';
import { SimulateurController } from './simulateur.controller';
import { SimulateurRepository } from './simulateur.repository';
import { SimulateurService } from './simulateur.service';

@Module({
  controllers: [SimulateurController],
  providers: [SimulateurService, SimulateurRepository],
  exports: [SimulateurService],
})
export class SimulateurModule {}
