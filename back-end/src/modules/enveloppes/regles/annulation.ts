import type { ImputabiliteMotif } from '@prisma/client';
import { dateParis, joursEntre } from '../../../shared/regles/dates';

/**
 * Imputabilité et poids d'une annulation (décisions du 18 novembre 2026). Fonctions pures.
 * - Un motif est imputable au mandataire, non imputable, laissé au choix du back-office, ou
 *   imputable selon le délai : seulement dans les derniers jours avant la date limite interne.
 * - Une annulation imputable compte pour 1 ; elle compte davantage (2) quand elle tombe dans ces
 *   derniers jours alors que la réservation avait été posée longtemps avant (plus de 30 jours).
 */
export function imputabiliteRetenue(mode: ImputabiliteMotif, x: { tardive: boolean; choixBackOffice: boolean | null }): boolean {
  switch (mode) {
    case 'IMPUTABLE':
      return true;
    case 'NON_IMPUTABLE':
      return false;
    case 'SELON_DELAI':
      return x.tardive;
    case 'AU_CHOIX':
      if (x.choixBackOffice === null) {
        throw new Error('Motif au choix du back-office : imputabilité à préciser.');
      }
      return x.choixBackOffice;
  }
}

/** Jours entre la saisie de la réservation et son annulation, vus de Paris. */
export function ancienneteJours(saisieLe: Date, annuleeLe: Date): number {
  return Math.max(0, joursEntre(dateParis(saisieLe), dateParis(annuleeLe)));
}

export function poidsAnnulation(x: {
  imputable: boolean;
  tardive: boolean;
  ancienneteJours: number;
  seuilAncienneteJours: number;
  poidsAggrave: number;
}): number {
  if (!x.imputable) return 0;
  return x.tardive && x.ancienneteJours > x.seuilAncienneteJours ? x.poidsAggrave : 1;
}
