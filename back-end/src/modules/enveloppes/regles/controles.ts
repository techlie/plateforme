import type { ModeArbitrage, StatutEnveloppe, TypeOperation } from '@prisma/client';
import { estDepassee } from '../../../shared/regles/dates';
import { d, Decimal, Montant, part, somme, ZERO } from './montants';
import { numeroConforme } from '../../../shared/regles/saisie';

/**
 * Contrôles à la saisie d'une réservation (section 6.3 du cahier des charges). Fonction pure :
 * elle classe chaque constat, le service décide.
 * - bloquant : la réservation ne peut pas être enregistrée ;
 * - derogeable : bloquant, sauf dérogation motivée par la personne habilitée ;
 * - alerte : signalée au mandataire et au back-office, sans blocage.
 */
export type CodeControle =
  | 'ENVELOPPE_FERMEE'
  | 'DATE_LIMITE'
  | 'DOUBLON'
  | 'CONTRAT_ABSENT'
  | 'FORMAT_CONTRAT'
  | 'GAMME_REQUISE'
  | 'GAMME_EXCLUE'
  | 'CODE_APPORTEUR'
  | 'MINIMUM'
  | 'MODE_ARBITRAGE'
  | 'FONDS_ABSENTS'
  | 'FONDS_TOTAL'
  | 'ENCOURS_CONTRAT'
  | 'ARBITRAGE_GLOBAL'
  | 'DEPASSEMENT'
  | 'DEPASSE_SOLDE_GLOBALE'
  | 'CONCENTRATION'
  | 'ENCOURS_ABSENT'
  | 'ESTIMATION_ARBITRAGE';

/** Qui peut déroger : le back-office (et l'administrateur), ou l'administrateur seul. */
export const DEROGATIONS: Partial<Record<CodeControle, 'BACK_OFFICE' | 'ADMINISTRATEUR'>> = {
  FORMAT_CONTRAT: 'BACK_OFFICE',
  DEPASSEMENT: 'BACK_OFFICE',
  DATE_LIMITE: 'ADMINISTRATEUR',
};

export interface Constat {
  code: CodeControle;
  message: string;
}

export interface EntreeControle {
  maintenant: Date;
  enveloppe: {
    statut: StatutEnveloppe;
    dateLimiteInterne: string;
    montantMinimum: Montant;
    seuilConcentration: Montant | null;
    gammesExclues: { id: string; nom: string }[];
    formatNumeroContrat: string | null;
    compagnieAGammes: boolean;
  };
  reservation: {
    typeOperation: TypeOperation;
    numeroContrat: string | null;
    /** Montant brut : c'est lui que les désinvestissements doivent égaler (décision du 18 novembre). */
    montantBrut: Montant;
    montantNet: Montant;
    encoursClient: Montant | null;
    gammeId: string | null;
    codeApporteurValide: boolean;
    modeArbitrage: ModeArbitrage | null;
    pourcentageArbitrage: Montant | null;
    valeurContrat: Montant | null;
    /** Montant de chaque ligne, calculé depuis le pourcentage de l'encours du contrat quand il est saisi ainsi. */
    fonds: { montant: Montant; pourcentage?: Montant | null }[];
  };
  /** Enveloppe restante, sans compter la réservation contrôlée. */
  restante: Montant;
  /** Solde de la réservation globale choisie comme source, le cas échéant. */
  soldeGlobale: Montant | null;
  /** Réservations actives du même client sur les enveloppes ouvertes, hors celle-ci. */
  cumulClientAutres: Montant;
  doublon: { numero: number } | null;
  seuilEstimationArbitrage: Montant;
}

export interface ResultatControle {
  bloquants: Constat[];
  derogeables: Constat[];
  alertes: Constat[];
  /** Part du montant dans l'encours du client, affichée au back-office. */
  partEncours: Decimal | null;
  /** Part du montant prise sur l'enveloppe restante (au-delà du solde d'une réservation globale). */
  priseSurEnveloppe: Decimal;
}

function euros(montant: Montant): string {
  return `${d(montant).toNumber().toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function pourcent(taux: Montant): string {
  return `${d(taux).times(100).toDecimalPlaces(2).toNumber().toLocaleString('fr-FR')} %`;
}

export function controlerReservation(e: EntreeControle): ResultatControle {
  const bloquants: Constat[] = [];
  const derogeables: Constat[] = [];
  const alertes: Constat[] = [];
  const r = e.reservation;
  const net = d(r.montantNet);
  const brut = d(r.montantBrut);

  if (e.enveloppe.statut !== 'OUVERTE' && e.enveloppe.statut !== 'FERMEE') {
    bloquants.push({ code: 'ENVELOPPE_FERMEE', message: 'Cette enveloppe n’est pas ouverte aux réservations.' });
  } else if (e.enveloppe.statut === 'FERMEE' || estDepassee(e.enveloppe.dateLimiteInterne, e.maintenant)) {
    derogeables.push({ code: 'DATE_LIMITE', message: 'La date limite interne est passée : seule une dérogation de l’administrateur permet encore de réserver.' });
  }

  if (e.doublon) {
    bloquants.push({
      code: 'DOUBLON',
      message: `Une réservation active existe déjà (n° ${e.doublon.numero}) : modifiez-la plutôt que d’en créer une seconde.`,
    });
  }

  if (r.typeOperation !== 'AFFAIRE_NOUVELLE') {
    if (!r.numeroContrat) {
      bloquants.push({ code: 'CONTRAT_ABSENT', message: 'Le numéro de contrat est obligatoire, sauf pour une affaire nouvelle.' });
    } else if (e.enveloppe.formatNumeroContrat && !numeroConforme(r.numeroContrat, e.enveloppe.formatNumeroContrat)) {
      derogeables.push({ code: 'FORMAT_CONTRAT', message: 'Le numéro de contrat ne respecte pas le format de la compagnie.' });
    }
  } else if (r.numeroContrat && e.enveloppe.formatNumeroContrat && !numeroConforme(r.numeroContrat, e.enveloppe.formatNumeroContrat)) {
    derogeables.push({ code: 'FORMAT_CONTRAT', message: 'Le numéro de contrat ne respecte pas le format de la compagnie.' });
  }

  if (e.enveloppe.compagnieAGammes && !r.gammeId) {
    bloquants.push({ code: 'GAMME_REQUISE', message: 'Choisissez la gamme du contrat.' });
  }
  const exclue = e.enveloppe.gammesExclues.find((g) => g.id === r.gammeId);
  if (exclue) {
    bloquants.push({ code: 'GAMME_EXCLUE', message: `La gamme ${exclue.nom} est exclue de cette enveloppe.` });
  }

  if (!r.codeApporteurValide) {
    bloquants.push({ code: 'CODE_APPORTEUR', message: 'Le code apporteur est absent, inactif ou non autorisé chez cette compagnie.' });
  }

  if (net.lessThan(d(e.enveloppe.montantMinimum))) {
    bloquants.push({ code: 'MINIMUM', message: `Le montant net est inférieur au minimum de l’enveloppe (${euros(e.enveloppe.montantMinimum)}).` });
  }

  if (r.typeOperation === 'ARBITRAGE') {
    if (!r.modeArbitrage) {
      bloquants.push({ code: 'MODE_ARBITRAGE', message: 'Précisez le mode d’arbitrage : global ou fonds par fonds.' });
    } else if (r.modeArbitrage === 'PAR_FONDS') {
      if (r.fonds.length === 0) {
        bloquants.push({ code: 'FONDS_ABSENTS', message: 'Indiquez les fonds à désinvestir.' });
      } else if (r.fonds.some((f) => f.pourcentage !== null && f.pourcentage !== undefined) && (r.valeurContrat === null || d(r.valeurContrat).lessThanOrEqualTo(0))) {
        bloquants.push({ code: 'ENCOURS_CONTRAT', message: 'Pour désinvestir en pourcentage, indiquez l’encours du contrat.' });
      } else {
        const total = somme(r.fonds.map((f) => f.montant));
        if (!total.equals(brut)) {
          bloquants.push({
            code: 'FONDS_TOTAL',
            message: `Le total des désinvestissements (${euros(total)}) doit égaler le montant brut (${euros(brut)}) : reste ${euros(brut.minus(total))} à répartir.`,
          });
        }
      }
    } else {
      const pct = r.pourcentageArbitrage === null ? null : d(r.pourcentageArbitrage);
      if (pct === null || r.valeurContrat === null || pct.lessThanOrEqualTo(0) || pct.greaterThan(1) || d(r.valeurContrat).lessThanOrEqualTo(0)) {
        bloquants.push({ code: 'ARBITRAGE_GLOBAL', message: 'Pour un arbitrage global, indiquez le pourcentage (100 % au plus) et l’encours du contrat.' });
      } else {
        const estime = pct.times(d(r.valeurContrat));
        if (part(estime.minus(brut).abs(), brut).greaterThan(d(e.seuilEstimationArbitrage))) {
          alertes.push({
            code: 'ESTIMATION_ARBITRAGE',
            message: `Le montant estimé (${euros(estime.toDecimalPlaces(2))}) s’écarte de plus de ${pourcent(e.seuilEstimationArbitrage)} du montant brut ; le montant réel dépendra de la valeur au jour de l’opération.`,
          });
        }
      }
    }
  }

  let priseSurEnveloppe = net;
  if (e.soldeGlobale !== null) {
    const solde = d(e.soldeGlobale);
    priseSurEnveloppe = net.greaterThan(solde) ? net.minus(solde) : ZERO;
    if (priseSurEnveloppe.greaterThan(0)) {
      alertes.push({
        code: 'DEPASSE_SOLDE_GLOBALE',
        message: `La réservation dépasse le solde de la réservation globale (${euros(solde)}) : ${euros(priseSurEnveloppe)} sont pris sur l’enveloppe globale.`,
      });
    }
  }
  if (priseSurEnveloppe.greaterThan(d(e.restante))) {
    derogeables.push({
      code: 'DEPASSEMENT',
      message: `Le montant dépasse l’enveloppe restante (${euros(Decimal.max(d(e.restante), ZERO))}) : inscription en liste d’attente, ou dérogation du back-office.`,
    });
  }

  let partEncours: Decimal | null = null;
  if (r.encoursClient === null || d(r.encoursClient).lessThanOrEqualTo(0)) {
    alertes.push({ code: 'ENCOURS_ABSENT', message: 'Encours du client non renseigné : la concentration n’a pas pu être contrôlée.' });
  } else {
    partEncours = part(net, r.encoursClient);
    const cumul = d(e.cumulClientAutres).plus(net);
    if (e.enveloppe.seuilConcentration !== null && part(cumul, r.encoursClient).greaterThan(d(e.enveloppe.seuilConcentration))) {
      alertes.push({
        code: 'CONCENTRATION',
        message: `Les réservations de ce client (${euros(cumul)}) dépassent ${pourcent(e.enveloppe.seuilConcentration)} de son encours.`,
      });
    }
  }

  return { bloquants, derogeables, alertes, partEncours, priseSurEnveloppe };
}
