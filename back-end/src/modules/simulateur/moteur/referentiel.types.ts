/**
 * Forme du référentiel de commissions.
 * Tous les taux sont en décimal : 0.30 pour 30 %.
 */

/** Façon de calculer la commission d'un contrat. */
export type ModeCalcul =
  /** (taux + ajout) × multiplicateur */
  | 'TAUX'
  /** (frais − déduction) × coefficient d'avance + surcommission */
  | 'ESCOMPTE'
  /** Taux lu dans un barème, selon les frais retenus */
  | 'BAREME'
  /** Taux qui dépend d'un seuil de cotisation */
  | 'SEUIL';

/** Ce que l'utilisateur doit renseigner pour ce contrat. */
export type ModeSaisie = 'LISTE' | 'FRAIS_LIBRES' | 'TAUX_MANUEL' | 'SEUIL';

/** Nature du montant saisi. */
export type BaseContrat = 'COTISATION_ANNUELLE' | 'VERSEMENT_ANNUEL' | 'VERSEMENT_UNIQUE';

export interface OptionCommission {
  code: string;
  libelle: string;
  /** Mode TAUX : taux de première année prévu par la compagnie. */
  taux?: number;
  /** Mode TAUX : taux des années suivantes, pour information. */
  tauxSuivants?: number[];
  /** Mode BAREME : frais correspondant à cette ligne du barème. */
  frais?: number;
  /** Mode BAREME : taux payé au mandataire pour le taux de réversion de référence. */
  tauxMandataireReference?: number;
}

export interface Variante {
  code: string;
  libelle: string;
  /** Mode ESCOMPTE : durée de l'avance en années. */
  duree?: number;
  /** Mode ESCOMPTE : coefficient d'avance. */
  coefficient?: number;
  /** Mode SEUIL : taux prévu par la compagnie pour cette tranche. */
  taux?: number;
}

export interface Remuneration {
  code: string;
  libelle: string;
  /** Part des frais que la compagnie retire avant de calculer la commission. */
  deductionFrais: number;
}

/** Part de la commission qui dépend de la répartition entre unités de compte et fonds en euros. */
export interface Surcommission {
  libelle: string;
  /** Part en unités de compte au-delà de laquelle le barème haut s'applique. */
  seuilPartUc: number;
  tauxUcAuDessus: number;
  tauxEuroAuDessus: number;
  tauxUcEnDessous: number;
  tauxEuroEnDessous: number;
  source: string;
}

/**
 * Baisse liée à l'âge de l'assuré.
 * Jusqu'à `ageDebut` : rien ne change. Entre les deux âges : coefficient (ageReference − âge) / diviseur.
 * À partir de `ageFin` : coefficient nul, ou `tauxApresAgeFin` à la place de l'escompte s'il est renseigné.
 */
export interface PonderationAge {
  ageDebut: number;
  ageFin: number;
  ageReference: number;
  diviseur: number;
  tauxApresAgeFin?: number;
  source: string;
}

export interface PlafondSurcommission {
  /** Versements annuels au-delà desquels la surcommission n'est plus versée, par client et par type de contrat. */
  montantAnnuel: number;
  source: string;
}

/** Part d'un barème qui ne dépend pas de l'âge (rappel, bonus), en taux compagnie. */
export interface PartFixeIncluse {
  taux: number;
  libelle: string;
  source: string;
}

export interface ContratReferentiel {
  cle: string;
  compagnie: string;
  compagnieLibelle: string;
  famille: string;
  familleLibelle: string;
  nom: string;
  libelle: string;
  base: BaseContrat;
  /** Vrai si la commission se calcule sur la cotisation hors taxe. */
  horsTaxe: boolean;
  mode: ModeCalcul;
  saisie: ModeSaisie;
  ajout?: number;
  multiplicateur?: number;
  fraisParDefaut?: number;
  tauxMin?: number;
  tauxMax?: number;
  aide?: string;
  fraisMax?: number;
  surcommission?: Surcommission;
  ponderationAge?: PonderationAge;
  plafondSurcommission?: PlafondSurcommission;
  partFixeIncluse?: PartFixeIncluse;
  seuilMontant?: number;
  options?: OptionCommission[];
  variantes?: Variante[];
  remunerations?: Remuneration[];
  remunerationParDefaut?: string;
  /** Hypothèses que le cabinet ou la compagnie doit encore confirmer. */
  aConfirmer?: string[];
}

export interface Referentiel {
  code: string;
  libelle: string;
  /** Premier jour d'application, au format AAAA-MM-JJ. */
  dateEffet: string;
  source: string;
  /** Part de la commission compagnie reçue par le cabinet, après retenue du courtier grossiste. */
  partCabinet: number;
  /** Passage d'une cotisation toutes taxes à une cotisation hors taxe. */
  coefficientHorsTaxe: number;
  /** Taux de réversion pour lequel les barèmes ont été relevés. */
  tauxReversionReference: number;
  contrats: ContratReferentiel[];
}
