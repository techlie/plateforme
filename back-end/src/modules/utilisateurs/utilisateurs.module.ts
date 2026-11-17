import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UtilisateursController } from './utilisateurs.controller';
import { UtilisateursRepository } from './utilisateurs.repository';
import { UtilisateursService } from './utilisateurs.service';

@Module({
  imports: [AuthModule],
  controllers: [UtilisateursController],
  providers: [UtilisateursRepository, UtilisateursService],
})
export class UtilisateursModule {}
