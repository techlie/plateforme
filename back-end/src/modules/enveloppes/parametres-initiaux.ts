import type { CategorieMotif, ImputabiliteMotif } from '@prisma/client';

/**
 * Valeurs de départ des paramètres du module, chacune avec sa source. Elles sont écrites en
 * base par le script d'initialisation, puis réglées par l'administrateur depuis l'écran.
 * Un délai encore ouvert reste vide : la plateforme l'affiche « à fixer ».
 */
export const PARAMETRES_INITIAUX = {
  /**
   * Décision du 18 novembre : pas de délai standard, une réservation ne se périme pas.
   * Le suivi passe par le récapitulatif hebdomadaire envoyé à chaque mandataire.
   */
  delaiHonorerJours: null,
  /** Décision du 18 novembre : pas de rappel avant échéance, remplacé par les récapitulatifs. */
  rappelAvantEcheanceJours: null,
  /** Décision du 12 novembre : anomalie dès 5 % d'écart, dans les deux sens. */
  seuilEcart: '0.05',
  /** Cahier des charges, 6.3 : alerte quand l'estimation d'un arbitrage global s'écarte de plus de 5 %. */
  seuilEstimationArbitrage: '0.05',
  /** Décision du 18 novembre : annulation tardive dans les 20 derniers jours avant la date limite interne. */
  delaiAnnulationTardiveJours: 20,
  /**
   * Décision du 15 novembre : 0,5 % par défaut, modifiable. Décision du 18 novembre : le taux
   * applicable à un mandataire est celui de sa convention, annexée à sa fiche ; à défaut, ce taux.
   */
  tauxClientsConfiesDefaut: '0.005',
  tauxClientsConfiesAConfirmer: false,
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
  /** Décision du 18 novembre : à 20 jours de la date limite interne, un second récapitulatif le lundi. */
  relancesRapprocheesJours: 20,
  emailingJourRapproche: 1,
  /** Décision du 18 novembre : à 14 jours, alerte au back-office sur les réservations pas assez avancées. */
  alerteBackOfficeJours: 14,
  /** Décision du 18 novembre : une annulation imputable compte double si elle est tardive sur une réservation de plus de 30 jours. */
  ancienneteAnnulationJours: 30,
  poidsAnnulationAggravee: 2,
};

type MotifInitial = { categorie: CategorieMotif; libelle: string; imputabilite?: ImputabiliteMotif; commentaireObligatoire?: boolean };

/**
 * Motifs de départ. Les autres s'ajoutent depuis l'écran d'administration.
 * Annulation : liste et imputabilité décidées le 18 novembre.
 *  - SELON_DELAI : imputable si l'annulation est tardive (20 derniers jours) ;
 *  - AU_CHOIX : le back-office décide au cas par cas et explique son choix.
 * Refus : reprise des motifs d'annulation qui s'appliquent avant validation.
 */
export const MOTIFS_INITIAUX: MotifInitial[] = [
  { categorie: 'ECART', libelle: 'Valorisation au jour de l’opération' },
  { categorie: 'ECART', libelle: 'Erreur de saisie interne' },
  { categorie: 'ECART', libelle: 'Désinvestissement erroné' },
  { categorie: 'ECART', libelle: 'Erreur compagnie' },
  { categorie: 'ECART', libelle: 'Autre', commentaireObligatoire: true },
  { categorie: 'RENVOI', libelle: 'Correction demandée', commentaireObligatoire: true },
  { categorie: 'RENVOI', libelle: 'Client à prévendre' },
  { categorie: 'RENVOI', libelle: 'Numéro de contrat à compléter' },
  { categorie: 'RENVOI', libelle: 'Fonds à désinvestir à compléter' },
  { categorie: 'REFUS', libelle: 'Dossier incomplet ou mal rempli' },
  { categorie: 'REFUS', libelle: 'Contrat ou fonds non éligible' },
  { categorie: 'REFUS', libelle: 'Enveloppe épuisée' },
  { categorie: 'REFUS', libelle: 'Enveloppe clôturée' },
  { categorie: 'REFUS', libelle: 'Erreur de saisie ou doublon' },
  { categorie: 'REFUS', libelle: 'Opération déjà en cours sur le contrat' },
  { categorie: 'ANNULATION', libelle: 'Le client renonce', imputabilite: 'SELON_DELAI' },
  { categorie: 'ANNULATION', libelle: 'Le client ne répond plus', imputabilite: 'SELON_DELAI' },
  { categorie: 'ANNULATION', libelle: 'Dossier incomplet ou mal rempli', imputabilite: 'IMPUTABLE' },
  { categorie: 'ANNULATION', libelle: 'Contrat ou fonds non éligible', imputabilite: 'IMPUTABLE' },
  { categorie: 'ANNULATION', libelle: 'Enveloppe épuisée', imputabilite: 'NON_IMPUTABLE' },
  { categorie: 'ANNULATION', libelle: 'Enveloppe clôturée', imputabilite: 'IMPUTABLE' },
  { categorie: 'ANNULATION', libelle: 'Arbitrage refusé par la compagnie', imputabilite: 'AU_CHOIX', commentaireObligatoire: true },
  { categorie: 'ANNULATION', libelle: 'Erreur de saisie ou doublon', imputabilite: 'IMPUTABLE' },
  { categorie: 'ANNULATION', libelle: 'Décès du client', imputabilite: 'NON_IMPUTABLE' },
  { categorie: 'ANNULATION', libelle: 'Opération déjà en cours sur le contrat', imputabilite: 'AU_CHOIX', commentaireObligatoire: true },
];
