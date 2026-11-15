import { ContratReferentiel, Referentiel } from './referentiel.types';

/**
 * Moteur de calcul des commissions.
 *
 * Fonctions pures : aucune lecture en base, aucune horloge, aucun taux en dur.
 * Tout ce qui est chiffré vient du référentiel passé en paramètre.
 */

export interface DemandeCalcul {
  /** Cotisation annuelle, versement annuel ou versement unique, en euros. */
  montant: number;
  /** Frais sur versements, en décimal (saisie FRAIS_LIBRES). */
  frais?: number;
  /** Code de l'option choisie (saisie LISTE). */
  option?: string;
  /** Taux de commission saisi à la main, en décimal (saisie TAUX_MANUEL). */
  taux?: number;
  /** Code de la variante : durée d'avance ou tranche de seuil. */
  variante?: string;
  /** Code de l'option de rémunération (mode ESCOMPTE). */
  remuneration?: string;
  /** Part de la commission du cabinet reversée au mandataire, en décimal. */
  tauxReversion: number;
}

export interface Composante {
  code: 'BASE' | 'SURCOMMISSION';
  libelle: string;
  /** Taux payé au mandataire pour cette composante, rapporté à la base de calcul. */
  taux: number;
  montant: number;
}

export interface Avertissement {
  code: string;
  message: string;
}

export interface ResultatCalcul {
  cleContrat: string;
  /** Montant sur lequel la commission est calculée. */
  baseCalcul: number;
  /** Vrai si la base est une cotisation hors taxe estimée. */
  baseHorsTaxe: boolean;
  /** Taux prévu par la compagnie, avant toute retenue. */
  tauxCompagnie: number;
  /** Taux reçu par le cabinet, après retenue du courtier grossiste. */
  tauxCabinet: number;
  /** Taux payé au mandataire. */
  tauxMandataire: number;
  montantCompagnie: number;
  montantCabinet: number;
  montantMandataire: number;
  composantes: Composante[];
  varianteRetenue?: string;
  remunerationRetenue?: string;
  avertissements: Avertissement[];
  aConfirmer: string[];
}

export class ErreurCalcul extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ErreurCalcul';
  }
}

/** Arrondit un montant au centime. À n'utiliser qu'en fin de calcul. */
export function arrondirAuCentime(montant: number): number {
  const centimes = Math.round(Math.abs(montant) * 100 + 1e-7);
  return (Math.sign(montant) * centimes) / 100;
}

export function trouverContrat(referentiel: Referentiel, cle: string): ContratReferentiel {
  const contrat = referentiel.contrats.find((c) => c.cle === cle);
  if (!contrat) {
    throw new ErreurCalcul('CONTRAT_INCONNU', 'Ce contrat ne figure pas dans le barème.');
  }
  return contrat;
}

function exigerTaux(valeur: number | undefined, code: string, message: string, min = 0, max = 1): number {
  if (valeur === undefined || valeur === null || !Number.isFinite(valeur) || valeur < min || valeur > max) {
    throw new ErreurCalcul(code, message);
  }
  return valeur;
}

interface TauxCompagnie {
  /** Taux hors surcommission. */
  base: number;
  surcommission: number;
  varianteRetenue?: string;
  remunerationRetenue?: string;
  avertissements: Avertissement[];
}

function tauxModeTaux(contrat: ContratReferentiel, demande: DemandeCalcul): TauxCompagnie {
  const ajout = contrat.ajout ?? 0;
  const multiplicateur = contrat.multiplicateur ?? 1;
  let taux: number;

  if (contrat.saisie === 'LISTE') {
    const option = (contrat.options ?? []).find((o) => o.code === demande.option);
    if (!option || option.taux === undefined) {
      throw new ErreurCalcul('OPTION_INCONNUE', 'Choisissez un mode de commission prévu pour ce contrat.');
    }
    taux = option.taux;
  } else if (contrat.saisie === 'FRAIS_LIBRES') {
    taux = exigerTaux(demande.frais, 'FRAIS_INVALIDES', 'Indiquez les frais, entre 0 et 100 %.');
  } else {
    const min = contrat.tauxMin ?? 0;
    const max = contrat.tauxMax ?? 1;
    taux = exigerTaux(
      demande.taux,
      'TAUX_INVALIDE',
      `Indiquez le taux de commission, entre ${min * 100} et ${max * 100} %.`,
      min,
      max,
    );
  }

  const avertissements: Avertissement[] = [];
  let base = (taux + ajout) * multiplicateur;
  if (base < 0) {
    base = 0;
    avertissements.push({
      code: 'FRAIS_SOUS_MINIMUM',
      message: 'Avec ces frais, la compagnie ne verse pas de commission sur ce contrat.',
    });
  }
  return { base, surcommission: 0, avertissements };
}

function tauxModeEscompte(contrat: ContratReferentiel, demande: DemandeCalcul): TauxCompagnie {
  const frais = exigerTaux(demande.frais, 'FRAIS_INVALIDES', 'Indiquez les frais, entre 0 et 100 %.');
  const variante = (contrat.variantes ?? []).find((v) => v.code === demande.variante);
  if (!variante || variante.coefficient === undefined) {
    throw new ErreurCalcul('VARIANTE_INCONNUE', "Choisissez une durée d'escompte prévue pour ce contrat.");
  }
  const codeRemuneration = demande.remuneration ?? contrat.remunerationParDefaut;
  const remuneration = (contrat.remunerations ?? []).find((r) => r.code === codeRemuneration);
  if (!remuneration) {
    throw new ErreurCalcul('REMUNERATION_INCONNUE', 'Choisissez une option de rémunération prévue pour ce contrat.');
  }

  const avertissements: Avertissement[] = [];
  const fraisRetenus = frais - remuneration.deductionFrais;
  if (fraisRetenus < 0) {
    avertissements.push({
      code: 'FRAIS_SOUS_MINIMUM',
      message: `Frais inférieurs à ${formaterPourcent(remuneration.deductionFrais)} : pas de commission de base.`,
    });
  }
  return {
    base: Math.max(fraisRetenus, 0) * variante.coefficient,
    surcommission: contrat.surcommission ?? 0,
    varianteRetenue: variante.code,
    remunerationRetenue: remuneration.code,
    avertissements,
  };
}

function tauxModeSeuil(contrat: ContratReferentiel, demande: DemandeCalcul, baseCalcul: number): TauxCompagnie {
  const variantes = contrat.variantes ?? [];
  let variante = variantes.find((v) => v.code === demande.variante);
  if (demande.variante && !variante) {
    throw new ErreurCalcul('VARIANTE_INCONNUE', 'Choisissez une tranche prévue pour ce contrat.');
  }
  if (!variante) {
    const atteint = baseCalcul >= (contrat.seuilMontant ?? 0);
    variante = variantes.find((v) => v.code === (atteint ? 'SEUIL_ATTEINT' : 'SOUS_SEUIL'));
  }
  if (!variante || variante.taux === undefined) {
    throw new ErreurCalcul('VARIANTE_INCONNUE', 'Choisissez une tranche prévue pour ce contrat.');
  }
  return { base: variante.taux, surcommission: 0, varianteRetenue: variante.code, avertissements: [] };
}

function formaterPourcent(taux: number): string {
  return `${(Math.round(taux * 10000) / 100).toLocaleString('fr-FR')} %`;
}

/**
 * Calcule la commission d'une affaire.
 *
 * Chaîne appliquée : compagnie → cabinet (après retenue du courtier grossiste) → mandataire.
 */
export function calculerCommission(referentiel: Referentiel, cleContrat: string, demande: DemandeCalcul): ResultatCalcul {
  const contrat = trouverContrat(referentiel, cleContrat);

  if (!Number.isFinite(demande.montant) || demande.montant < 0) {
    throw new ErreurCalcul('MONTANT_INVALIDE', 'Indiquez un montant positif.');
  }
  const reversion = exigerTaux(demande.tauxReversion, 'REVERSION_INVALIDE', 'Taux de réversion du mandataire invalide.');

  const baseCalcul = contrat.horsTaxe ? demande.montant * referentiel.coefficientHorsTaxe : demande.montant;

  let tauxCompagnie: number;
  let tauxCabinet: number;
  let tauxMandataire: number;
  let partBase = 1;
  let detail: TauxCompagnie;

  if (contrat.mode === 'BAREME') {
    const option = (contrat.options ?? []).find((o) => o.code === demande.option);
    if (!option || option.tauxMandataireReference === undefined) {
      throw new ErreurCalcul('OPTION_INCONNUE', 'Choisissez un niveau de frais prévu pour ce contrat.');
    }
    // Le barème donne le taux payé au mandataire pour le taux de réversion de référence.
    tauxCabinet = option.tauxMandataireReference / referentiel.tauxReversionReference;
    tauxCompagnie = tauxCabinet / referentiel.partCabinet;
    tauxMandataire = tauxCabinet * reversion;
    detail = { base: tauxCompagnie, surcommission: 0, avertissements: [] };
  } else {
    if (contrat.mode === 'ESCOMPTE') {
      detail = tauxModeEscompte(contrat, demande);
    } else if (contrat.mode === 'SEUIL') {
      detail = tauxModeSeuil(contrat, demande, baseCalcul);
    } else {
      detail = tauxModeTaux(contrat, demande);
    }
    tauxCompagnie = detail.base + detail.surcommission;
    tauxCabinet = tauxCompagnie * referentiel.partCabinet;
    tauxMandataire = tauxCabinet * reversion;
    partBase = tauxCompagnie > 0 ? detail.base / tauxCompagnie : 1;
  }

  const montantMandataire = arrondirAuCentime(baseCalcul * tauxMandataire);
  const composantes: Composante[] = [];
  if (detail.surcommission > 0) {
    // La dernière composante absorbe l'arrondi : le total reste exact au centime.
    const montantBase = arrondirAuCentime(baseCalcul * tauxMandataire * partBase);
    composantes.push({
      code: 'BASE',
      libelle: 'Commission de base',
      taux: tauxMandataire * partBase,
      montant: montantBase,
    });
    composantes.push({
      code: 'SURCOMMISSION',
      libelle: 'Surcommission',
      taux: tauxMandataire * (1 - partBase),
      montant: arrondirAuCentime(montantMandataire - montantBase),
    });
  }

  return {
    cleContrat,
    baseCalcul: arrondirAuCentime(baseCalcul),
    baseHorsTaxe: contrat.horsTaxe,
    tauxCompagnie,
    tauxCabinet,
    tauxMandataire,
    montantCompagnie: arrondirAuCentime(baseCalcul * tauxCompagnie),
    montantCabinet: arrondirAuCentime(baseCalcul * tauxCabinet),
    montantMandataire,
    composantes,
    varianteRetenue: detail.varianteRetenue,
    remunerationRetenue: detail.remunerationRetenue,
    avertissements: detail.avertissements,
    aConfirmer: contrat.aConfirmer ?? [],
  };
}
