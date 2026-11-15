import { BaseContrat, ModeSaisie } from '../moteur/referentiel.types';

/**
 * Ce que le serveur renvoie à l'écran du simulateur.
 *
 * Ces formes sont celles d'un profil mandataire : elles ne contiennent ni les taux internes
 * du barème, ni ce que le cabinet reçoit de la compagnie.
 */

export interface ChoixSimulateur {
  code: string;
  libelle: string;
}

export interface ContratSimulateur {
  cle: string;
  compagnie: string;
  famille: string;
  libelle: string;
  base: BaseContrat;
  horsTaxe: boolean;
  saisie: ModeSaisie;
  options: ChoixSimulateur[];
  variantes: ChoixSimulateur[];
  remunerations: ChoixSimulateur[];
  remunerationParDefaut?: string;
  fraisParDefaut?: number;
  fraisMax?: number;
  /** Vrai si la commission dépend de l'âge de l'assuré. */
  demandeAge: boolean;
  /** Vrai si la commission dépend de la part investie en unités de compte. */
  demandePartUc: boolean;
  /** Versements annuels au-delà desquels la surcommission n'est plus versée, par client et par type de contrat. */
  plafondAnnuel?: number;
  tauxMin?: number;
  tauxMax?: number;
  seuilMontant?: number;
  aide?: string;
}

export interface CatalogueSimulateur {
  bareme: { code: string; libelle: string; dateEffet: string };
  /** Co-courtage : taux proposé par défaut et taux maximal accepté. */
  coCourtage: { tauxParDefaut: number; tauxMax: number };
  contrats: ContratSimulateur[];
}

export interface LigneResultat {
  code: string;
  libelle: string;
  montant: number;
}

export interface ResultatSimulation {
  bareme: { code: string; libelle: string; dateEffet: string };
  cleContrat: string;
  /** Commission estimée pour le mandataire, en euros. */
  montant: number;
  /** Montant sur lequel la commission est calculée. */
  baseCalcul: number;
  baseHorsTaxe: boolean;
  lignes: LigneResultat[];
  varianteRetenue?: string;
  remunerationRetenue?: string;
  avertissements: { code: string; message: string }[];
  /** Présent seulement en co-courtage : ce que reçoit le cabinet d'expertise comptable. */
  coCourtage?: { taux: number; montant: number };
  /** Règle de reprise du contrat et ce qu'elle donnerait sur cette affaire. */
  reprise: {
    regle: string;
    calcul?: string;
    exemples: { mois: number; taux: number; montant: number }[];
    note?: string;
    aConfirmer: string[];
  };
  /** Points du barème que le cabinet doit encore confirmer. */
  reserves: string[];
}
