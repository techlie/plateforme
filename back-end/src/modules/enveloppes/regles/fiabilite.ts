import type { StatutReservation } from '@prisma/client';
import { dateParis, joursEntre } from '../../../shared/regles/dates';
import { d, Decimal, Montant, part, somme, ZERO } from './montants';

/**
 * Indicateurs de fiabilité d'un apporteur (section 9). Ils éclairent la décision de restreindre
 * un mandataire ; ils ne la déclenchent jamais seuls. Fonction pure.
 */
export interface LigneFiabilite {
  statut: StatutReservation;
  montantNet: Montant;
  montantValide: Montant | null;
  valideeLe: Date | null;
  dateOperation: string | null;
  annulationTardive: boolean | null;
  /** Pour une réservation annulée : imputabilité retenue au moment de l'annulation, et son poids. */
  annulationImputable: boolean | null;
  poidsAnnulation: number | null;
  /** Réservation libérée parce que le produit a été annulé ou reporté : sans effet sur la fiabilité. */
  horsFiabilite?: boolean;
}

export interface AnnulationPartielle {
  montantRetire: Montant;
  tardive: boolean;
  imputable: boolean;
  poids: number;
}

export interface Fiabilite {
  /** Validé ÷ réservé, chaque ligne plafonnée à 100 % ; nul quand aucune ligne n'est comptée. */
  tauxRealisation: Decimal | null;
  lignesComptees: number;
  annulationsDansLesDelais: { nombre: number; montant: Decimal };
  annulationsTardives: { nombre: number; montant: Decimal };
  /** Somme des poids des annulations imputables : 1 chacune, 2 si tardive sur une réservation ancienne. */
  poidsAnnulations: number;
  prolongations: number;
  nonHonorees: { nombre: number; montant: Decimal };
  /** Jours entre la validation de la réservation et la date de l'opération déclarée. */
  delaiMoyenJours: number | null;
}

const FINAUX_COMPTES: StatutReservation[] = ['VERIFIEE', 'ECART_A_JUSTIFIER', 'LIBEREE', 'ANNULEE', 'ANNULEE_APRES_OPERATION'];

export function calculerFiabilite(entree: {
  maintenant: Date;
  lignes: LigneFiabilite[];
  annulationsPartielles: AnnulationPartielle[];
  prolongations: number;
}): Fiabilite {
  entree = { ...entree, lignes: entree.lignes.filter((l) => !l.horsFiabilite) };
  const debut = new Date(entree.maintenant);
  debut.setUTCFullYear(debut.getUTCFullYear() - 1);

  // Taux de réalisation : réservations validées par le back-office dans les 12 derniers mois et
  // arrivées à leur terme ; une annulation non imputable au mandataire n'y entre pas.
  const comptees = entree.lignes.filter(
    (l) =>
      l.valideeLe !== null &&
      l.valideeLe >= debut &&
      FINAUX_COMPTES.includes(l.statut) &&
      !((l.statut === 'ANNULEE' || l.statut === 'ANNULEE_APRES_OPERATION') && l.annulationImputable !== true),
  );
  const reserve = somme(comptees.map((l) => l.montantNet));
  const realise = somme(
    comptees
      .filter((l) => (l.statut === 'VERIFIEE' || l.statut === 'ECART_A_JUSTIFIER') && l.montantValide !== null)
      .map((l) => Decimal.min(d(l.montantValide as Montant), d(l.montantNet))),
  );

  const annulees = entree.lignes.filter((l) => (l.statut === 'ANNULEE' || l.statut === 'ANNULEE_APRES_OPERATION') && l.annulationImputable === true);
  const partielles = entree.annulationsPartielles.filter((a) => a.imputable);
  const dansLesDelais = [
    ...annulees.filter((l) => !l.annulationTardive).map((l) => l.montantNet),
    ...partielles.filter((a) => !a.tardive).map((a) => a.montantRetire),
  ];
  const tardives = [
    ...annulees.filter((l) => l.annulationTardive).map((l) => l.montantNet),
    ...partielles.filter((a) => a.tardive).map((a) => a.montantRetire),
  ];

  const poidsAnnulations = annulees.reduce((t, l) => t + (l.poidsAnnulation ?? 1), 0) + partielles.reduce((t, a) => t + a.poids, 0);
  const liberees = entree.lignes.filter((l) => l.statut === 'LIBEREE');
  const delais = entree.lignes
    .filter((l) => l.valideeLe !== null && l.dateOperation !== null)
    .map((l) => Math.max(0, joursEntre(dateParis(l.valideeLe as Date), l.dateOperation as string)));

  return {
    tauxRealisation: comptees.length === 0 ? null : part(realise, reserve),
    lignesComptees: comptees.length,
    annulationsDansLesDelais: { nombre: dansLesDelais.length, montant: somme(dansLesDelais) },
    annulationsTardives: { nombre: tardives.length, montant: somme(tardives) },
    poidsAnnulations,
    prolongations: entree.prolongations,
    nonHonorees: { nombre: liberees.length, montant: liberees.length ? somme(liberees.map((l) => l.montantNet)) : ZERO },
    delaiMoyenJours: delais.length === 0 ? null : Math.round((delais.reduce((a, b) => a + b, 0) / delais.length) * 10) / 10,
  };
}
