import type { SourceReservation, StatutReservation, TypeMouvement } from '@prisma/client';
import { d, Decimal, max, Montant, part, somme, ZERO } from './montants';
import { estActif, estVerifie } from './statuts';

export interface MouvementCompte {
  type: TypeMouvement;
  montant: Montant;
}

export interface ReservationCompte {
  statut: StatutReservation;
  montantNet: Montant;
  montantValide: Montant | null;
  source: SourceReservation;
  reservationGlobaleId: string | null;
}

export interface GlobaleCompte {
  id: string;
  montant: Montant;
  montantLibere: Montant;
}

export interface Compteurs {
  enveloppeTotale: Decimal;
  /** Montant retenu : validé une fois vérifié, réservé jusque-là, réservations globales comprises. */
  retenu: Decimal;
  /** « Enveloppe restante » (théorique). Négative après une dérogation de dépassement. */
  restante: Decimal;
  /** « Réel validé par la compagnie ». */
  reelValide: Decimal;
  reelRestant: Decimal;
  tauxRemplissage: Decimal;
  tauxReel: Decimal;
  /** Dépassement autorisé, positif quand l'enveloppe restante est négative. */
  depassement: Decimal;
}

/** Montant que retient une réservation active : le validé dès la vérification, le réservé avant. */
export function montantRetenu(r: ReservationCompte): Decimal {
  if (!estActif(r.statut)) {
    return ZERO;
  }
  return estVerifie(r.statut) && r.montantValide !== null ? d(r.montantValide) : d(r.montantNet);
}

/**
 * Double enveloppe (section 6.1).
 * - Enveloppe totale = montant initial + rallonges − restitutions.
 * - Restante = totale − montants retenus. Une réservation globale est déduite une fois, en entier ;
 *   les réservations qui y puisent ne sont déduites à nouveau que pour la part qui dépasse son solde.
 * - Réel restant = totale − montants validés par la compagnie.
 */
export function calculerCompteurs(entree: {
  montantInitial: Montant;
  mouvements: MouvementCompte[];
  reservations: ReservationCompte[];
  globales: GlobaleCompte[];
}): Compteurs {
  const enveloppeTotale = entree.mouvements.reduce<Decimal>(
    (total, m) => (m.type === 'RALLONGE' ? total.plus(d(m.montant)) : total.minus(d(m.montant))),
    d(entree.montantInitial),
  );

  const horsGlobale = entree.reservations.filter((r) => r.source === 'ENVELOPPE' || !r.reservationGlobaleId);
  let retenu = somme(horsGlobale.map(montantRetenu));
  for (const g of entree.globales) {
    const consomme = somme(entree.reservations.filter((r) => r.reservationGlobaleId === g.id).map(montantRetenu));
    retenu = retenu.plus(max(d(g.montant).minus(d(g.montantLibere)), consomme));
  }

  const reelValide = somme(
    entree.reservations.filter((r) => estActif(r.statut) && estVerifie(r.statut) && r.montantValide !== null).map((r) => r.montantValide as Montant),
  );
  const restante = enveloppeTotale.minus(retenu);
  return {
    enveloppeTotale,
    retenu,
    restante,
    reelValide,
    reelRestant: enveloppeTotale.minus(reelValide),
    tauxRemplissage: part(retenu, enveloppeTotale),
    tauxReel: part(reelValide, enveloppeTotale),
    depassement: restante.isNegative() ? restante.negated() : ZERO,
  };
}

/** Solde d'une réservation globale : montant − part libérée − consommé (jamais négatif). */
export function soldeGlobale(g: GlobaleCompte, reservations: ReservationCompte[]): { consomme: Decimal; solde: Decimal } {
  const consomme = somme(reservations.filter((r) => r.reservationGlobaleId === g.id).map(montantRetenu));
  return { consomme, solde: max(d(g.montant).minus(d(g.montantLibere)).minus(consomme), ZERO) };
}

/** Seuils franchis (ex. 0,8 et 1 pour 80 % et 100 %) par un taux de remplissage. */
export function seuilsFranchis(taux: Montant, seuils: Montant[]): string[] {
  return seuils.filter((s) => d(taux).greaterThanOrEqualTo(d(s))).map((s) => d(s).toString());
}
