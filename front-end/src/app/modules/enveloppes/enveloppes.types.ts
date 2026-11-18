/** Types et libellés du module Enveloppes, tels que le serveur les envoie. */

export type StatutEnveloppe = 'EN_PREPARATION' | 'OUVERTE' | 'FERMEE' | 'CLOTUREE' | 'ANNULEE' | 'REPORTEE';
export type StatutReservation =
  | 'SOUMISE'
  | 'LISTE_ATTENTE'
  | 'RENVOYEE'
  | 'REFUSEE'
  | 'VALIDEE'
  | 'OPERATION_PASSEE'
  | 'VERIFIEE'
  | 'ECART_A_JUSTIFIER'
  | 'ECHUE'
  | 'LIBEREE'
  | 'ANNULEE'
  | 'ANNULEE_APRES_OPERATION';
export type TypeOperation = 'ARBITRAGE' | 'VERSEMENT_LIBRE' | 'AFFAIRE_NOUVELLE';
export type TypeClient = 'PHYSIQUE' | 'MORALE';
export type ModeArbitrage = 'GLOBAL' | 'PAR_FONDS';
export type ModeOperation = 'DEMATERIALISE' | 'PAPIER';
export type CategorieMotif = 'REFUS' | 'RENVOI' | 'ANNULATION' | 'ECART';
export type CategorieDocument = 'DOCUMENTATION_TECHNIQUE' | 'AVENANT_COMPAGNIE' | 'FICHE_PRODUIT' | 'AVENANT_VIERGE' | 'PREUVE_VERIFICATION' | 'JUSTIFICATIF_OPERATION';
export type CodeDerogation = 'FORMAT_CONTRAT' | 'DEPASSEMENT' | 'DATE_LIMITE';

export interface Constat {
  code: string;
  message: string;
}

export interface DocumentDepose {
  id: string;
  categorie: CategorieDocument;
  nom: string;
  typeMime: string;
  taille: number;
  createdAt: string;
  auteur: string;
}

export interface Compteurs {
  enveloppeTotale: string;
  restante: string;
  tauxRemplissage: string;
  depassement: string;
  reelValide?: string;
  reelRestant?: string;
  tauxReel?: string;
}

export interface Enveloppe {
  id: string;
  compagnie: { id: string; nom: string; exempleNumeroContrat: string | null; aUnFormat: boolean };
  gammes: { id: string; nom: string }[];
  nomProduit: string;
  isin: string | null;
  montantInitial: string;
  dateOuverture: string;
  dateLimiteInterne: string;
  dateFinCommercialisation: string;
  dateClotureProduit: string;
  joursRestants: number;
  tauxCommission: string;
  tauxClientsConfies: string;
  rendement: string | null;
  seuilConcentration: string | null;
  montantMinimum: string;
  controlePatrimoine: boolean;
  statut: StatutEnveloppe;
  gammesExclues: { id: string; nom: string }[];
  documents: DocumentDepose[];
  compteurs: Compteurs;
  upfrontReel?: string | null;
  mouvements?: { id: string; type: 'RALLONGE' | 'RESTITUTION'; montant: string; motif: string; auteur: string; date: string }[];
  reservationsGlobales?: {
    id: string;
    apporteur: { id: string; nom: string; prenom: string };
    montant: string;
    montantLibere: string;
    consomme: string;
    solde: string;
    motif: string;
    echeance: string;
    statut: 'ACTIVE' | 'ECHUE' | 'SOLDEE';
    auteur: string;
  }[];
}

export interface LigneFonds {
  id?: string;
  fondsId: string | null;
  nom: string;
  isin: string | null;
  montant: string;
  horsReferentiel?: boolean;
}

export interface Reservation {
  id: string;
  numero: number;
  enveloppe: { id: string; nomProduit: string; compagnie: string | { id: string; nom: string }; controlePatrimoine: boolean; statut?: StatutEnveloppe; dateLimiteInterne?: string; isin?: string | null };
  apporteur: { id: string; nom: string; prenom: string };
  entite: { id: string; nom: string } | null;
  typeOperation: TypeOperation;
  typeClient: TypeClient;
  clientNom: string;
  clientPrenom: string | null;
  numeroContrat: string | null;
  numeroDemande: string | null;
  codeApporteur: { id: string; code: string } | null;
  gamme: { id: string; nom: string } | null;
  montantBrut: string;
  tauxFrais: string;
  montantNet: string;
  clientPrevendu: boolean;
  encoursClient: string | null;
  partEncours: string | null;
  origineClient: 'MANDATAIRE' | 'CONFIE';
  source: 'ENVELOPPE' | 'RESERVATION_GLOBALE';
  reservationGlobaleId: string | null;
  statut: StatutReservation;
  echeance: string | null;
  tauxCommission: string;
  tauxFige: boolean;
  commissionEstimee: string;
  commissionDefinitive: string | null;
  accordAdministrateur: boolean;
  modeArbitrage: ModeArbitrage | null;
  pourcentageArbitrage: string | null;
  valeurContrat: string | null;
  fonds: LigneFonds[];
  accordClientLe: string | null;
  avenantVersion: number;
  patrimoineAJour: boolean;
  datePatrimoine: string | null;
  dateOperation: string | null;
  modeOperation: ModeOperation | null;
  montantValide: string | null;
  ecart: string | null;
  ecartPct: string | null;
  dateValidationCompagnie: string | null;
  motif: { libelle: string; categorie: CategorieMotif } | null;
  commentaireMotif: string | null;
  motifEcart: string | null;
  commentaireEcart: string | null;
  signalements: string[];
  derogations: string[];
  valideeLe: string | null;
  annuleeLe: string | null;
  annulationTardive: boolean | null;
  operationDeclareeLe: string | null;
  createdAt: string;
  estApporteur: boolean;
  rang?: number;
}

export interface DetailReservation extends Reservation {
  historique: { id: string; date: string; action: string; auteur: string; deStatut: StatutReservation | null; versStatut: StatutReservation | null; commentaire: string | null; details: Record<string, unknown> | null }[];
  documents: DocumentDepose[];
  droits: { gestion: boolean; administrateur: boolean; decider: boolean; modifier: boolean };
}

export interface Apercu {
  montantNet: string;
  commissionEstimee: string;
  taux: string;
  restanteAvant: string;
  restanteApres: string;
  partEncours: string | null;
  codeApporteurId: string | null;
  bloquants: Constat[];
  derogeables: Constat[];
  alertes: Constat[];
}

export interface Motif {
  id: string;
  categorie: CategorieMotif;
  libelle: string;
  imputable: boolean;
  commentaireObligatoire: boolean;
  actif: boolean;
}

export interface Fonds {
  id: string;
  nom: string;
  isin: string | null;
  ouvert: boolean;
  dateFermeture: string | null;
  origine: 'IMPORT' | 'SAISIE';
  anciensNoms: string[];
}

export interface Compagnie {
  id: string;
  nom: string;
  formatNumeroContrat: string | null;
  exempleNumeroContrat: string | null;
  actif: boolean;
  gammes: { id: string; nom: string; actif: boolean }[];
}

export interface Apporteur {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  role: 'MANDATAIRE' | 'ASSOCIE' | 'SALARIE';
  restreint: boolean;
  habiliteReservationGlobale: boolean;
  actif: boolean;
  entite: { id: string; nom: string } | null;
  compte: { id: string; email: string; actif: boolean } | null;
  codes: { id: string; code: string; nature: string; actif: boolean; compagnieId: string }[];
}

export interface CodeApporteur {
  id: string;
  code: string;
  nature: 'PROPRE' | 'PARTENARIAT' | 'ENTITE';
  dateDebut: string | null;
  dateFin: string | null;
  actif: boolean;
  compagnie: { id: string; nom: string };
  apporteurs: { id: string; nom: string; prenom: string }[];
}

export interface ClientConfie {
  id: string;
  enveloppe: { id: string; nomProduit: string; statut: StatutEnveloppe; compagnie: { nom: string } };
  apporteur: { id: string; nom: string; prenom: string };
  typeClient: TypeClient;
  clientNom: string;
  clientPrenom: string | null;
  numeroContrat: string | null;
  taux: string;
  statut: 'CONFIE' | 'ACCEPTE' | 'RETIRE';
  reservation: { id: string; numero: number; statut: StatutReservation } | null;
  auteur: string;
  date: string;
}

export interface Fiabilite {
  apporteur: { id: string; nom: string; prenom: string; entite: { nom: string } | null; restreint: boolean };
  tauxRealisation: string | null;
  lignesComptees: number;
  annulationsDansLesDelais: { nombre: number; montant: string };
  annulationsTardives: { nombre: number; montant: string };
  prolongations: number;
  nonHonorees: { nombre: number; montant: string };
  delaiMoyenJours: number | null;
}

export interface Parametres {
  delaiHonorerJours: number | null;
  rappelAvantEcheanceJours: number | null;
  seuilEcart: string;
  seuilEstimationArbitrage: string;
  delaiAnnulationTardiveJours: number;
  tauxClientsConfiesDefaut: string;
  tauxClientsConfiesAConfirmer: boolean;
  seuilConcentrationDefaut: string;
  compteAReboursJours: number[];
  seuilsRemplissage: string[];
  seuilsReelValide: string[];
  emailingJour: number;
  emailingHeure: string;
  emailingValideLe: string | null;
  emailingValidePar: string | null;
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

export const LIBELLES_STATUTS_ENVELOPPE: Record<StatutEnveloppe, string> = {
  EN_PREPARATION: 'En préparation',
  OUVERTE: 'Ouverte',
  FERMEE: 'Fermée aux réservations',
  CLOTUREE: 'Clôturée',
  ANNULEE: 'Annulée',
  REPORTEE: 'Reportée',
};

export const LIBELLES_TYPES: Record<TypeOperation, string> = {
  ARBITRAGE: 'Arbitrage',
  VERSEMENT_LIBRE: 'Versement libre',
  AFFAIRE_NOUVELLE: 'Affaire nouvelle',
};

export const LIBELLES_DOCUMENTS: Record<CategorieDocument, string> = {
  DOCUMENTATION_TECHNIQUE: 'Documentation technique',
  AVENANT_COMPAGNIE: 'Avenant compagnie',
  FICHE_PRODUIT: 'Fiche produit',
  AVENANT_VIERGE: 'Avenant vierge',
  PREUVE_VERIFICATION: 'Preuve de vérification',
  JUSTIFICATIF_OPERATION: 'Justificatif d’opération',
};

/** Ton de la pastille de statut : neutre, en cours, réussi, alerte, clos. */
export function tonStatut(statut: StatutReservation): 'neutre' | 'attente' | 'succes' | 'alerte' | 'clos' {
  switch (statut) {
    case 'VERIFIEE':
      return 'succes';
    case 'ECART_A_JUSTIFIER':
    case 'ECHUE':
    case 'RENVOYEE':
      return 'alerte';
    case 'REFUSEE':
    case 'LIBEREE':
    case 'ANNULEE':
    case 'ANNULEE_APRES_OPERATION':
      return 'clos';
    case 'SOUMISE':
    case 'LISTE_ATTENTE':
      return 'attente';
    default:
      return 'neutre';
  }
}

/** Ce que le mandataire doit faire sur sa réservation, en une phrase. */
export function actionMandataire(r: Reservation): string | null {
  switch (r.statut) {
    case 'RENVOYEE':
      return `À corriger : ${r.motif?.libelle ?? 'voir le motif'}`;
    case 'SOUMISE':
      return r.clientPrevendu ? null : 'Client à prévendre';
    case 'VALIDEE':
    case 'ECHUE':
      if (r.enveloppe.controlePatrimoine && !r.patrimoineAJour) return 'Mettre à jour la situation patrimoniale';
      if (r.typeOperation === 'AFFAIRE_NOUVELLE' && !r.numeroContrat) return 'Compléter le numéro de contrat';
      if (r.typeOperation === 'ARBITRAGE' && !r.accordClientLe) return 'Déclarer l’accord du client';
      return 'Déclarer l’opération';
    default:
      return null;
  }
}
