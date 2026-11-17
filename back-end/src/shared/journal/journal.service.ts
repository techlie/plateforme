import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EntreeJournal {
  action: string;
  message: string;
  succes: boolean;
  userId?: string | null;
  auteur?: string | null;
  cible?: string | null;
  details?: Prisma.InputJsonValue;
  adresseIp?: string | null;
}

/**
 * Écrit dans le journal des actions sensibles : qui, quoi, quand.
 * Le journal ne se modifie pas et ne se vide pas ; aucune méthode ne le permet.
 */
@Injectable()
export class JournalService {
  private readonly logger = new Logger('Journal');

  constructor(private readonly prisma: PrismaService) {}

  async ecrire(entree: EntreeJournal): Promise<void> {
    try {
      await this.prisma.log.create({
        data: {
          action: entree.action,
          message: entree.message,
          statut: entree.succes ? 'SUCCES' : 'ECHEC',
          userId: entree.userId ?? null,
          auteur: entree.auteur ?? null,
          cible: entree.cible ?? null,
          details: entree.details,
          adresseIp: entree.adresseIp ?? null,
        },
      });
    } catch (erreur) {
      // Une panne du journal ne doit pas passer inaperçue, mais ne bloque pas l'action déjà faite.
      this.logger.error(`Écriture impossible dans le journal : ${entree.action}`, erreur as Error);
    }
  }
}
