import { ContratReferentiel, PonderationAge, Referentiel } from './referentiel.types';

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
  /** Âge de l'assuré, en années révolues. Exigé quand le contrat a une pondération d'âge. */
  age?: number;
  /** Part des versements investie en unités de compte, en décimal. Exigée quand la commission en dépend. */
  partUc?: number;
  /** Versements annuels déjà en place pour ce client sur le même type de contrat, en euros. */
  versementsExistants?: number;
  /**
   * Part reversée à un cabinet d'expertise comptable en co-courtage, en décimal, sur la commission
   * brute versée par la compagnie. Absente ou nulle : pas de co-courtage.
   */
  tauxCoCourtage?: number;
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
  /** Co-courtage : taux et montant reversés au cabinet d'expertise comptable. Zéro sans co-courtage. */
  tauxCoCourtage: number;
  montantCoCourtage: number;
  composantes: Composante[];
  /** Vrai quand la compagnie verse une commission linéaire à la place de l'escompte du barème. */
  escompteRemplace: boolean;
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

function formaterPourcent(taux: number): string {
  return `${(Math.round(taux * 10000) / 100).toLocaleString('fr-FR')} %`;
}

function formaterEuros(montant: number): string {
  return `${Math.round(montant).toLocaleString('fr-FR')} €`;
}

function exigerTaux(valeur: number | undefined, code: string, message: string, min = 0, max = 1): number {
  if (valeur === undefined || valeur === null || !Number.isFinite(valeur) || valeur < min || valeur > max) {
    throw new ErreurCalcul(code, message);
  }
  return valeur;
}

function exigerFrais(contrat: ContratReferentiel, demande: DemandeCalcul): number {
  const max = contrat.fraisMax ?? 1;
  return exigerTaux(demande.frais, 'FRAIS_INVALIDES', `Indiquez les frais, entre 0 et ${formaterPourcent(max)}.`, 0, max);
}

function exigerAge(demande: DemandeCalcul): number {
  const age = demande.age;
  if (age === undefined || age === null || !Number.isInteger(age) || age < 0 || age > 120) {
    throw new ErreurCalcul('AGE_MANQUANT', "Indiquez l'âge de l'assuré.");
  }
  return age;
}

/** Coefficient d'âge entre 0 et 1. Vaut exactement 1 tant que l'âge de début n'est pas dépassé. */
export function coefficientAge(regle: PonderationAge, age: number): number {
  if (age <= regle.ageDebut) {
    return 1;
  }
  if (age >= regle.ageFin) {
    return 0;
  }
  return Math.min(1, Math.max(0, (regle.ageReference - age) / regle.diviseur));
}

interface TauxCompagnie {
  /** Taux hors surcommission. */
  base: number;
  surcommission: number;
  libelleSurcommission?: string;
  varianteRetenue?: string;
  remunerationRetenue?: string;
  escompteRemplace?: boolean;
  avertissements: Avertissement[];
}

/**
 * Surcommission versée par la compagnie, rapportée au montant de l'affaire.
 * Elle dépend de la part en unités de compte, puis de l'âge de l'assuré, puis du plafond de versement.
 */
function surcommissionCompagnie(contrat: ContratReferentiel, demande: DemandeCalcul, avertissements: Avertissement[]): number {
  const regle = contrat.surcommission;
  if (!regle) {
    return 0;
  }
  const partUc = exigerTaux(
    demande.partUc,
    'PART_UC_MANQUANTE',
    'Indiquez la part investie en unités de compte, entre 0 et 100 %.',
  );
  const auDessus = partUc > regle.seuilPartUc;
  let taux = auDessus
    ? partUc * regle.tauxUcAuDessus + (1 - partUc) * regle.tauxEuroAuDessus
    : partUc * regle.tauxUcEnDessous + (1 - partUc) * regle.tauxEuroEnDessous;
  const nom = regle.libelle.toLowerCase();
  if (!auDessus && regle.tauxUcEnDessous < regle.tauxUcAuDessus) {
    avertissements.push({
      code: 'PART_UC_SOUS_SEUIL',
      message: `Part en unités de compte de ${formaterPourcent(regle.seuilPartUc)} ou moins : la ${nom} est réduite.`,
    });
  }

  if (contrat.ponderationAge) {
    const age = exigerAge(demande);
    const coefficient = coefficientAge(contrat.ponderationAge, age);
    if (coefficient === 0) {
      avertissements.push({
        code: 'AGE_SANS_SURCOMMISSION',
        message: `Assuré de ${contrat.ponderationAge.ageFin} ans ou plus : pas de ${nom}.`,
      });
    } else if (coefficient < 1) {
      avertissements.push({
        code: 'AGE_SURCOMMISSION_REDUITE',
        message: `Assuré de plus de ${contrat.ponderationAge.ageDebut} ans : la ${nom} est réduite.`,
      });
    }
    taux *= coefficient;
  }

  if (contrat.plafondSurcommission && demande.montant > 0) {
    const existants = demande.versementsExistants ?? 0;
    if (!Number.isFinite(existants) || existants < 0) {
      throw new ErreurCalcul('VERSEMENTS_INVALIDES', 'Indiquez un montant positif pour les versements déjà en place.');
    }
    const plafond = contrat.plafondSurcommission.montantAnnuel;
    const assiette = Math.max(0, Math.min(demande.montant, plafond - existants));
    if (assiette < demande.montant) {
      avertissements.push({
        code: 'PLAFOND_SURCOMMISSION',
        message: `Au-delà de ${formaterEuros(plafond / 12)} par mois, par client et par type de contrat, la ${nom} n'est plus versée.`,
      });
      taux *= assiette / demande.montant;
    }
  }
  return taux;
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
    taux = exigerFrais(contrat, demande);
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
      message: `Frais inférieurs à ${formaterPourcent(-ajout)} : pas de commission de base.`,
    });
  }
  return {
    base,
    surcommission: surcommissionCompagnie(contrat, demande, avertissements),
    libelleSurcommission: contrat.surcommission?.libelle,
    avertissements,
  };
}

function tauxModeEscompte(contrat: ContratReferentiel, demande: DemandeCalcul): TauxCompagnie {
  const frais = exigerFrais(contrat, demande);
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
    surcommission: surcommissionCompagnie(contrat, demande, avertissements),
    libelleSurcommission: contrat.surcommission?.libelle,
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

/**
 * Barème relevé dans la grille : il donne le taux payé au mandataire pour le taux de réversion de référence.
 * Quand le contrat a une pondération d'âge, elle porte sur l'escompte, pas sur la part fixe (rappel, bonus).
 */
function tauxModeBareme(referentiel: Referentiel, contrat: ContratReferentiel, demande: DemandeCalcul): TauxCompagnie {
  const option = (contrat.options ?? []).find((o) => o.code === demande.option);
  if (!option || option.tauxMandataireReference === undefined) {
    throw new ErreurCalcul('OPTION_INCONNUE', 'Choisissez un niveau de frais prévu pour ce contrat.');
  }
  const plein = option.tauxMandataireReference / referentiel.tauxReversionReference / referentiel.partCabinet;
  const avertissements: Avertissement[] = [];
  const regle = contrat.ponderationAge;
  if (!regle) {
    return { base: plein, surcommission: 0, avertissements };
  }

  const age = exigerAge(demande);
  if (age <= regle.ageDebut) {
    return { base: plein, surcommission: 0, avertissements };
  }
  const partFixe = contrat.partFixeIncluse?.taux ?? 0;
  const escompte = Math.max(plein - partFixe, 0);
  if (age >= regle.ageFin) {
    const apres = regle.tauxApresAgeFin ?? 0;
    avertissements.push({
      code: 'AGE_ESCOMPTE_REMPLACE',
      message:
        apres > 0
          ? `Assuré de ${regle.ageFin} ans ou plus : la compagnie verse ${formaterPourcent(apres)} par an au lieu de l'escompte.`
          : `Assuré de ${regle.ageFin} ans ou plus : la compagnie ne verse plus l'escompte.`,
    });
    return { base: Math.min(apres, escompte) + partFixe, surcommission: 0, escompteRemplace: true, avertissements };
  }
  avertissements.push({
    code: 'AGE_ESCOMPTE_REDUIT',
    message: `Assuré de plus de ${regle.ageDebut} ans : l'escompte versé par la compagnie est réduit.`,
  });
  return { base: escompte * coefficientAge(regle, age) + partFixe, surcommission: 0, avertissements };
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

  let detail: TauxCompagnie;
  if (contrat.mode === 'BAREME') {
    detail = tauxModeBareme(referentiel, contrat, demande);
  } else if (contrat.mode === 'ESCOMPTE') {
    detail = tauxModeEscompte(contrat, demande);
  } else if (contrat.mode === 'SEUIL') {
    detail = tauxModeSeuil(contrat, demande, baseCalcul);
  } else {
    detail = tauxModeTaux(contrat, demande);
  }

  // Co-courtage : la part du cabinet d'expertise comptable se calcule sur la commission brute de la
  // compagnie. Le mandataire reçoit son taux de reversement sur ce qui reste au cabinet.
  const tauxCoCourtage = demande.tauxCoCourtage ?? 0;
  const maxCoCourtage = Math.min(referentiel.coCourtage.tauxMax, referentiel.partCabinet);
  if (!Number.isFinite(tauxCoCourtage) || tauxCoCourtage < 0 || tauxCoCourtage > maxCoCourtage) {
    throw new ErreurCalcul(
      'CO_COURTAGE_INVALIDE',
      `Indiquez la part du cabinet d'expertise comptable, entre 0 et ${formaterPourcent(maxCoCourtage)}.`,
    );
  }

  const tauxCompagnie = detail.base + detail.surcommission;
  const tauxCabinet = tauxCompagnie * referentiel.partCabinet;
  const tauxMandataire = tauxCompagnie * (referentiel.partCabinet - tauxCoCourtage) * reversion;
  const partBase = tauxCompagnie > 0 ? detail.base / tauxCompagnie : 1;

  const montantMandataire = arrondirAuCentime(baseCalcul * tauxMandataire);
  const composantes: Composante[] = [];
  if (detail.libelleSurcommission) {
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
      libelle: detail.libelleSurcommission,
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
    tauxCoCourtage,
    montantCoCourtage: arrondirAuCentime(baseCalcul * tauxCompagnie * tauxCoCourtage),
    composantes,
    escompteRemplace: detail.escompteRemplace ?? false,
    varianteRetenue: detail.varianteRetenue,
    remunerationRetenue: detail.remunerationRetenue,
    avertissements: detail.avertissements,
    aConfirmer: contrat.aConfirmer ?? [],
  };
}
