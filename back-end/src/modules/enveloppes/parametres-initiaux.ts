import type { CategorieMotif } from '@prisma/client';

/**
 * Valeurs de départ des paramètres du module, chacune avec sa source. Elles sont écrites en
 * base par le script d'initialisation, puis réglées par l'administrateur depuis l'écran.
 * Un délai encore ouvert reste vide : la plateforme l'affiche « à fixer ».
 */
export const PARAMETRES_INITIAUX = {
  /** Point ouvert : délai standard pour honorer une réservation. */
  delaiHonorerJours: null,
  /** Point ouvert : délai du rappel avant échéance. */
  rappelAvantEcheanceJours: null,
  /** Décision du 12 novembre : anomalie dès 5 % d'écart, dans les deux sens. */
  seuilEcart: '0.05',
  /** Cahier des charges, 6.3 : alerte quand l'estimation d'un arbitrage global s'écarte de plus de 5 %. */
  seuilEstimationArbitrage: '0.05',
  /** Cahier des charges, 6.8 : annulation tardive dans les 15 derniers jours avant la date limite interne. */
  delaiAnnulationTardiveJours: 15,
  /** Décision du 15 novembre : 0,5 % par défaut, modifiable ; sens exact à confirmer. */
  tauxClientsConfiesDefaut: '0.005',
  tauxClientsConfiesAConfirmer: true,
  /** Décision : concentration limitée à 15 % de l'encours total du client. */
  seuilConcentrationDefaut: '0.15',
  /** Cahier des charges, 7 : compte à rebours 10 et 3 jours avant la date limite interne. */
  compteAReboursJours: [10, 3],
  /** Cahier des charges, 7 : enveloppe remplie à 80 % puis 100 % ; réel validé à 95 % puis 100 %. */
  seuilsRemplissage: ['0.8', '1'],
  seuilsReelValide: ['0.95', '1'],
  /** Décision : mail hebdomadaire le jeudi à 9 h 01. */
  emailingJour: 4,
  emailingHeure: '09:01',
};

/** Motifs écrits dans le cahier des charges. Les autres s'ajoutent depuis l'écran d'administration. */
export const MOTIFS_INITIAUX: { categorie: CategorieMotif; libelle: string; imputable?: boolean; commentaireObligatoire?: boolean }[] = [
  { categorie: 'ECART', libelle: 'Valorisation au jour de l’opération' },
  { categorie: 'ECART', libelle: 'Erreur de saisie interne' },
  { categorie: 'ECART', libelle: 'Désinvestissement erroné' },
  { categorie: 'ECART', libelle: 'Erreur compagnie' },
  { categorie: 'ECART', libelle: 'Autre', commentaireObligatoire: true },
  { categorie: 'RENVOI', libelle: 'Correction demandée', commentaireObligatoire: true },
  { categorie: 'RENVOI', libelle: 'Client à prévendre' },
  { categorie: 'RENVOI', libelle: 'Numéro de contrat à compléter' },
  { categorie: 'RENVOI', libelle: 'Fonds à désinvestir à compléter' },
  // Exemple du cahier des charges (section 9) : une annulation due à la compagnie n'est pas imputable.
  { categorie: 'ANNULATION', libelle: 'Arbitrage refusé par la compagnie', imputable: false },
];
