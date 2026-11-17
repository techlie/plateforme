import { Module } from '@nestjs/common';
import { ReferentielsModule } from '../referentiels/referentiels.module';
import { DocumentsService } from './documents.service';
import { EnveloppesController } from './enveloppes.controller';
import { EnveloppesRepository } from './enveloppes.repository';
import { EnveloppesService } from './enveloppes.service';
import { NotificationsEnveloppesService } from './notifications.service';
import { PlanificateurService } from './planificateur.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [ReferentielsModule],
  controllers: [EnveloppesController, ReservationsController],
  providers: [EnveloppesRepository, EnveloppesService, ReservationsService, NotificationsEnveloppesService, DocumentsService, PlanificateurService],
  exports: [EnveloppesService, ReservationsService],
})
export class EnveloppesModule {}
