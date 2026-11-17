import type { ModulePlateforme, Profil } from '@prisma/client';

export interface FicheUtilisateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  profil: Profil;
  actif: boolean;
  /** Vrai une fois que la personne a choisi son mot de passe. */
  compteActive: boolean;
  bloque: boolean;
  entite: { id: string; nom: string } | null;
  modules: ModulePlateforme[];
  derniereConnexion: string | null;
  createdAt: string;
}
