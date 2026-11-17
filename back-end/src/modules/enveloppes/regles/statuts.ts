import type { StatutReservation } from '@prisma/client';

/** Statuts qui retiennent un montant sur l'enveloppe (section 4 du cahier des charges). */
export const STATUTS_ACTIFS: readonly StatutReservation[] = [
  'SOUMISE',
  'RENVOYEE',
  'VALIDEE',
  'OPERATION_PASSEE',
  'VERIFIEE',
  'ECART_A_JUSTIFIER',
  'ECHUE',
];

/** Statuts où le montant validé par la compagnie remplace le montant réservé. */
export const STATUTS_VERIFIES: readonly StatutReservation[] = ['VERIFIEE', 'ECART_A_JUSTIFIER'];

/** Statuts antérieurs à l'opération : l'annulation par le mandataire y est encore possible. */
export const STATUTS_AVANT_OPERATION: readonly StatutReservation[] = ['SOUMISE', 'LISTE_ATTENTE', 'RENVOYEE', 'VALIDEE', 'ECHUE'];

/** Statuts postérieurs à l'opération : seul le back-office peut encore annuler. */
export const STATUTS_APRES_OPERATION: readonly StatutReservation[] = ['OPERATION_PASSEE', 'VERIFIEE', 'ECART_A_JUSTIFIER'];

/** Statuts finaux : l'enveloppe ne se clôture que quand chaque réservation en a un. */
export const STATUTS_FINAUX: readonly StatutReservation[] = ['VERIFIEE', 'REFUSEE', 'LIBEREE', 'ANNULEE', 'ANNULEE_APRES_OPERATION'];

export function estActif(statut: StatutReservation): boolean {
  return STATUTS_ACTIFS.includes(statut);
}

export function estVerifie(statut: StatutReservation): boolean {
  return STATUTS_VERIFIES.includes(statut);
}

export const LIBELLES_STATUTS: Record<StatutReservation, string> = {
  SOUMISE: 'Soumise',
  LISTE_ATTENTE: 'Liste d’attente',
  RENVOYEE: 'Renvoyée',
  REFUSEE: 'Refusée',
  VALIDEE: 'Validée',
  OPERATION_PASSEE: 'Opération passée',
  VERIFIEE: 'Vérifiée compagnie',
  ECART_A_JUSTIFIER: 'Écart à justifier',
  ECHUE: 'Échue, à traiter',
  LIBEREE: 'Libérée',
  ANNULEE: 'Annulée',
  ANNULEE_APRES_OPERATION: 'Annulée après opération',
};
