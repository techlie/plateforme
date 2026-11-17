import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { EntitesModule } from './modules/entites/entites.module';
import { EnveloppesModule } from './modules/enveloppes/enveloppes.module';
import { JournalLectureModule } from './modules/journal/journal.module';
import { ReferentielsModule } from './modules/referentiels/referentiels.module';
import { SimulateurModule } from './modules/simulateur/simulateur.module';
import { UtilisateursModule } from './modules/utilisateurs/utilisateurs.module';
import { ConfigurationModule } from './shared/configuration.module';
import { CourrielModule } from './shared/courriel/courriel.module';
import { JournalModule } from './shared/journal/journal.module';
import { PrismaModule } from './shared/prisma/prisma.module';

@Module({
  imports: [
    ConfigurationModule,
    PrismaModule,
    JournalModule,
    CourrielModule,
    AuthModule,
    UtilisateursModule,
    EntitesModule,
    JournalLectureModule,
    SimulateurModule,
    ReferentielsModule,
    EnveloppesModule,
  ],
})
export class AppModule {}
