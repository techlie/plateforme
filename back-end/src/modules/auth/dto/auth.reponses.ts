import type { ModulePlateforme, Profil } from '@prisma/client';

export interface ReponseConnexion {
  etape: 'CODE';
  demande: string;
  adresseMasquee: string;
  validiteMinutes: number;
}

export interface ProfilConnecte {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  profil: Profil;
  modules: ModulePlateforme[];
  entite: { id: string; nom: string } | null;
}
