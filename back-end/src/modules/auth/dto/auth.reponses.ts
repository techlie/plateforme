import type { ModulePlateforme, Profil } from '@prisma/client';

export type ReponseConnexion =
  | {
      etape: 'CODE';
      demande: string;
      adresseMasquee: string;
      validiteMinutes: number;
    }
  | {
      /** Appareil reconnu : le code n'est pas redemandé, la session est ouverte. */
      etape: 'CONNECTE';
      utilisateur: ProfilConnecte;
    };

export interface ProfilConnecte {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  profil: Profil;
  modules: ModulePlateforme[];
  entite: { id: string; nom: string } | null;
}
