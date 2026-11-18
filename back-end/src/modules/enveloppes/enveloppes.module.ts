import { Module } from '@nestjs/common';
import { DocumentsModule } from '../../shared/documents/documents.module';
import { ReferentielsModule } from '../referentiels/referentiels.module';
import { EnveloppesController } from './enveloppes.controller';
import { EnveloppesRepository } from './enveloppes.repository';
import { EnveloppesService } from './enveloppes.service';
import { NotificationsEnveloppesService } from './notifications.service';
import { PlanificateurService } from './planificateur.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [ReferentielsModule, DocumentsModule],
  controllers: [EnveloppesController, ReservationsController],
  providers: [EnveloppesRepository, EnveloppesService, ReservationsService, NotificationsEnveloppesService, PlanificateurService],
  exports: [EnveloppesService, ReservationsService],
})
export class EnveloppesModule {}
