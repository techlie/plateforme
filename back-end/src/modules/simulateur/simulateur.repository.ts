import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Referentiel } from './moteur/referentiel.types';

/**
 * Accès aux barèmes de commissions.
 *
 * Chaque barème est un fichier daté dans `prisma/data`. Un nouveau barème s'ajoute à côté
 * des précédents : il ne les remplace pas, pour qu'un calcul passé reste reproductible.
 */
@Injectable()
export class SimulateurRepository {
  private readonly dossier = path.join(process.cwd(), 'prisma', 'data');
  private referentiels: Referentiel[] | null = null;

  private charger(): Referentiel[] {
    if (!this.referentiels) {
      this.referentiels = fs
        .readdirSync(this.dossier)
        .filter((nom) => /^referentiel-commissions-.*\.json$/.test(nom))
        .map((nom) => JSON.parse(fs.readFileSync(path.join(this.dossier, nom), 'utf8')) as Referentiel)
        .sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
    }
    return this.referentiels;
  }

  /** Barème applicable à la date donnée (AAAA-MM-JJ) : le plus récent déjà entré en vigueur. */
  trouverEnVigueur(date: string): Referentiel | null {
    const applicables = this.charger().filter((r) => r.dateEffet <= date);
    return applicables.length ? applicables[applicables.length - 1] : null;
  }
}
