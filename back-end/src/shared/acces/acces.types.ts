import type { ModulePlateforme, Profil } from '@prisma/client';

/** Ce que le serveur sait de la personne connectée, rattaché à chaque demande. */
export interface UtilisateurConnecte {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  profil: Profil;
  modules: ModulePlateforme[];
  entite: { id: string; nom: string } | null;
  sessionId: string;
}

export const PROFILS_ADMINISTRATION: Profil[] = ['SUPER_ADMINISTRATEUR', 'ADMINISTRATEUR'];

export const TOUS_LES_MODULES: ModulePlateforme[] = ['SIMULATEUR', 'ENVELOPPES', 'AFFAIRES', 'BORDEREAU', 'SYNTHESE_CONTRATS'];

/** Le super administrateur a tous les modules ; les autres, ceux cochés sur leur fiche. */
export function modulesEffectifs(profil: Profil, coches: ModulePlateforme[]): ModulePlateforme[] {
  return profil === 'SUPER_ADMINISTRATEUR' ? [...TOUS_LES_MODULES] : coches;
}

export function nomComplet(u: { prenom: string; nom: string }): string {
  return `${u.prenom} ${u.nom}`.trim();
}
