/** Formes échangées avec le serveur. Elles reprennent celles de `back-end/src/modules/simulateur/dto`. */

export type ModeSaisie = 'LISTE' | 'FRAIS_LIBRES' | 'TAUX_MANUEL' | 'SEUIL';
export type BaseContrat = 'COTISATION_ANNUELLE' | 'VERSEMENT_ANNUEL' | 'VERSEMENT_UNIQUE';

export interface Choix {
  code: string;
  libelle: string;
}

export interface Contrat {
  cle: string;
  compagnie: string;
  famille: string;
  libelle: string;
  base: BaseContrat;
  horsTaxe: boolean;
  saisie: ModeSaisie;
  options: Choix[];
  variantes: Choix[];
  remunerations: Choix[];
  remunerationParDefaut?: string;
  fraisParDefaut?: number;
  fraisMax?: number;
  demandeAge: boolean;
  demandePartUc: boolean;
  plafondAnnuel?: number;
  tauxMin?: number;
  tauxMax?: number;
  seuilMontant?: number;
  aide?: string;
}

export interface Bareme {
  code: string;
  libelle: string;
  dateEffet: string;
}

export interface Catalogue {
  bareme: Bareme;
  tauxReversion: { proposes: number[]; parDefaut: number };
  coCourtage: { tauxParDefaut: number; tauxMax: number };
  contrats: Contrat[];
}

export interface DemandeCalcul {
  cleContrat: string;
  montant: number;
  frais?: number;
  option?: string;
  taux?: number;
  variante?: string;
  remuneration?: string;
  age?: number;
  partUc?: number;
  versementsExistants?: number;
  tauxCoCourtage?: number;
  tauxReversion?: number;
}

export interface Reprise {
  regle: string;
  calcul?: string;
  exemples: { mois: number; libelle: string; taux: number; montant: number }[];
  note?: string;
  aConfirmer: string[];
}

export interface Resultat {
  bareme: Bareme;
  cleContrat: string;
  montant: number;
  tauxReversion: number;
  baseCalcul: number;
  baseHorsTaxe: boolean;
  lignes: { code: string; libelle: string; montant: number }[];
  varianteRetenue?: string;
  remunerationRetenue?: string;
  avertissements: { code: string; message: string }[];
  coCourtage?: { taux: number; montant: number };
  reprise: Reprise;
  reserves: string[];
}
