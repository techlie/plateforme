export type Profil = 'SUPER_ADMINISTRATEUR' | 'ADMINISTRATEUR' | 'BACK_OFFICE' | 'MANDATAIRE' | 'GESTIONNAIRE_PORTEFEUILLE';

export type ModulePlateforme = 'SIMULATEUR' | 'ENVELOPPES' | 'AFFAIRES' | 'BORDEREAU' | 'SYNTHESE_CONTRATS';

export interface ProfilConnecte {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  profil: Profil;
  modules: ModulePlateforme[];
  entite: { id: string; nom: string } | null;
}

export interface ReponseConnexion {
  etape: 'CODE';
  demande: string;
  adresseMasquee: string;
  validiteMinutes: number;
}

export const PROFILS_ADMINISTRATION: Profil[] = ['SUPER_ADMINISTRATEUR', 'ADMINISTRATEUR'];

/** Profils qui gèrent les enveloppes : back-office et administrateurs. */
export const PROFILS_GESTION: Profil[] = [...PROFILS_ADMINISTRATION, 'BACK_OFFICE'];

export const LIBELLES_PROFILS: Record<Profil, string> = {
  SUPER_ADMINISTRATEUR: 'Super administrateur',
  ADMINISTRATEUR: 'Administrateur',
  BACK_OFFICE: 'Back-office',
  MANDATAIRE: 'Mandataire',
  GESTIONNAIRE_PORTEFEUILLE: 'Gestionnaire de portefeuille',
};

export const LIBELLES_MODULES: Record<ModulePlateforme, string> = {
  SIMULATEUR: 'Simulateur',
  ENVELOPPES: 'Enveloppes',
  AFFAIRES: 'Mes affaires',
  BORDEREAU: 'Bordereau',
  SYNTHESE_CONTRATS: 'Synthèse des contrats',
};

/** Message lisible tiré d'une erreur du serveur. */
export function messageErreur(erreur: unknown, parDefaut = 'Une erreur est survenue. Réessayez.'): string {
  const corps = (erreur as { error?: { message?: unknown } })?.error;
  const message = corps?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return parDefaut;
}
