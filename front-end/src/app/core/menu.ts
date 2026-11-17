import { ModulePlateforme } from './session.types';

export interface EntreeMenu {
  libelle: string;
  /** Libellé du menu latéral quand le libellé complet est trop long. */
  libelleCourt?: string;
  /** Tracé de l'icône, dans une grille de 24 × 24. */
  icone: string[];
  /** Absent tant que le module n'est pas construit : il est annoncé, pas cliquable. */
  lien?: string;
  description: string;
}

export const ENTREES_MODULES: Record<ModulePlateforme, EntreeMenu> = {
  ENVELOPPES: {
    libelle: 'Enveloppes',
    icone: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
    description: 'Réserver sur les campagnes de produits structurés.',
  },
  SIMULATEUR: {
    libelle: 'Simulateur',
    lien: '/simulateur',
    icone: ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8 7h8', 'M8 12h2', 'M14 12h2', 'M8 16h2', 'M14 16h2'],
    description: 'Combien je gagne sur cette affaire, et quand.',
  },
  AFFAIRES: {
    libelle: 'Mes affaires',
    icone: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
    description: 'Suivre chaque affaire jusqu’à son règlement.',
  },
  BORDEREAU: {
    libelle: 'Bordereau',
    icone: ['M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M3 10h18', 'M16 15h2'],
    description: 'Le bordereau du mois, prêt à envoyer.',
  },
  SYNTHESE_CONTRATS: {
    libelle: 'Synthèse des contrats',
    libelleCourt: 'Synthèse',
    icone: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'],
    description: 'Le récapitulatif des contrats d’un client.',
  },
};

export const ORDRE_MODULES: ModulePlateforme[] = ['ENVELOPPES', 'SIMULATEUR', 'AFFAIRES', 'BORDEREAU', 'SYNTHESE_CONTRATS'];

export const ENTREES_ADMINISTRATION: EntreeMenu[] = [
  {
    libelle: 'Utilisateurs',
    lien: '/administration/utilisateurs',
    icone: ['M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 20v-1a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
    description: 'Comptes, profils, modules et entités.',
  },
  {
    libelle: 'Journal',
    lien: '/administration/journal',
    icone: ['M12 8v4l3 3', 'M3 12a9 9 0 1 0 9-9 9 9 0 0 0-9 9z'],
    description: 'Qui a fait quoi, et quand.',
  },
];
