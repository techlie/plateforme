import { arrondirAuCentime, DemandeCalcul, ResultatCalcul } from './moteur-commission';
import { ContratReferentiel } from './referentiel.types';

/**
 * Reprises de commission.
 *
 * Quand un contrat s'arrête, la compagnie peut reprendre tout ou partie de la commission. La reprise
 * est répercutée au mandataire au prorata de ce qu'il a reçu : les montants ci-dessous sont donc
 * calculés sur sa propre commission. Fonctions pures, règles lues dans le référentiel.
 */

export interface ExempleReprise {
  /** Mois d'arrêt du contrat, compté depuis sa date d'effet. */
  mois: number;
  /** Moment de l'arrêt, en clair : « 1re année » pour une règle par année, « 18e mois » sinon. */
  libelle: string;
  /** Part de la commission du mandataire qui serait reprise. */
  taux: number;
  montant: number;
}

export interface EstimationReprise {
  regle: string;
  calcul?: string;
  /** Ce que la reprise donnerait sur l'affaire simulée, à quelques dates d'arrêt. */
  exemples: ExempleReprise[];
  /** Précision propre à l'affaire simulée. */
  note?: string;
  aConfirmer: string[];
}

/** Écrit un nombre entier avec une espace fine entre les milliers, sans dépendre de la langue du serveur. */
function milliers(nombre: number): string {
  return String(Math.round(nombre)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

function anneeDuMois(mois: number): number {
  return Math.ceil(mois / 12);
}

function sansDoublon(mois: number[]): number[] {
  return [...new Set(mois)].sort((a, b) => a - b);
}

/** Estime la reprise que subirait le mandataire sur l'affaire simulée. */
export function estimerReprise(contrat: ContratReferentiel, demande: DemandeCalcul, calcul: ResultatCalcul): EstimationReprise {
  const regle = contrat.reprise;
  const total = calcul.montantMandataire;
  const estimation: EstimationReprise = {
    regle: regle.resume,
    calcul: regle.calcul,
    exemples: [],
    aConfirmer: regle.aConfirmer ?? [],
  };
  const exemple = (mois: number, montant: number, parAnnee = false): ExempleReprise => {
    const arrondi = arrondirAuCentime(Math.min(Math.max(montant, 0), total));
    const annee = anneeDuMois(mois);
    const libelle = parAnnee ? `${annee}${annee === 1 ? 're' : 'e'} année` : `${mois}e mois`;
    return { mois, libelle, taux: total > 0 ? arrondi / total : 0, montant: arrondi };
  };
  if (total <= 0) {
    return estimation;
  }

  const tauxAnnee = (mois: number): number => regle.tauxParAnnee?.[anneeDuMois(mois) - 1] ?? 0;

  switch (regle.type) {
    case 'PRORATA_DUREE': {
      if (calcul.escompteRemplace) {
        estimation.note = "La compagnie verse ici une commission linéaire et non un escompte : rien n'est avancé, donc rien à reprendre sur cette part.";
        return estimation;
      }
      const duree = regle.dureeMois as number;
      const partFixe = regle.horsPartFixe ? (contrat.partFixeIncluse?.taux ?? 0) : 0;
      const reprenable = calcul.tauxCompagnie > 0 ? (total * Math.max(calcul.tauxCompagnie - partFixe, 0)) / calcul.tauxCompagnie : 0;
      const mois = sansDoublon([6, 18, duree / 2, duree - 12]).filter((m) => m > 0 && m < duree);
      estimation.exemples = mois.map((m) =>
        exemple(m, m <= (regle.totaliteJusquAuMois ?? 0) ? reprenable : (reprenable * (duree - m)) / duree),
      );
      return estimation;
    }

    case 'PAR_ANNEE': {
      // Taux de l'année d'arrêt appliqué à toute la commission, quel que soit le mois.
      const grosVersement = regle.annee5 !== undefined && demande.montant / 12 > regle.annee5.seuilMensuel;
      const taux = [...(regle.tauxParAnnee ?? [])];
      if (grosVersement && regle.annee5) {
        taux.push(regle.annee5.taux);
      }
      estimation.exemples = taux.map((t, i) => exemple(12 * i + 6, total * t, true));
      if (regle.annee5 && !grosVersement) {
        estimation.note = `Versement de ${milliers(regle.annee5.seuilMensuel)} € par mois ou moins : pas de reprise la 5e année.`;
      }
      return estimation;
    }

    case 'PAR_ANNEE_APPORT': {
      const option = (contrat.options ?? []).find((o) => o.code === demande.option);
      const premiere = option?.taux ?? 0;
      const suivantes = option?.tauxSuivants?.[0];
      if (!option || suivantes === undefined || suivantes >= premiere || premiere <= 0) {
        estimation.note = "Commission linéaire : rien n'est avancé, il n'y a pas de reprise.";
        return estimation;
      }
      const apport = (total * (premiere - suivantes)) / premiere;
      const annees = regle.tauxParAnnee?.length ?? 0;
      estimation.exemples = [6, 18, 30].slice(0, annees).map((m) => exemple(m, apport * tauxAnnee(m), true));
      return estimation;
    }

    case 'PRORATA_PREMIERE_ANNEE': {
      estimation.exemples = [3, 6, 9].map((m) => exemple(m, (total * (12 - m)) / 12));
      return estimation;
    }

    case 'EQUIVALENT_LINEAIRE': {
      const option = (contrat.options ?? []).find((o) => o.code === demande.option);
      const premiere = option?.taux ?? 0;
      const equivalent = option ? regle.equivalentsLineaires?.[option.code] : undefined;
      if (equivalent === undefined || premiere <= 0) {
        estimation.note = "Le protocole ne donne pas l'équivalent linéaire de ce mode de commission : la reprise ne peut pas être chiffrée ici.";
        return estimation;
      }
      // Pendant la première année, la commission versée d'avance est celle de l'année entière.
      estimation.exemples = [6, 12].map((m) => exemple(m, (total * (premiere - (equivalent * m) / 12)) / premiere));
      return estimation;
    }

    default:
      return estimation;
  }
}
