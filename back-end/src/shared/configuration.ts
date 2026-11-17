/**
 * Variables d'environnement de la plateforme, lues et vérifiées en un seul endroit.
 * Aucune valeur secrète n'a de valeur par défaut : sans elle, le serveur refuse de démarrer.
 */
export interface Configuration {
  production: boolean;
  /** Clé qui scelle les codes de connexion et les jetons. Au moins 32 caractères. */
  cleSecrete: string;
  /** Adresse publique de l'application, pour les liens envoyés par courriel. */
  urlApplication: string;
  courriel: {
    expediteur: string;
    smtp?: { hote: string; port: number; securise: boolean; utilisateur?: string; motDePasse?: string };
  };
  session: { dureeHeures: number; inactiviteMinutes: number };
  /** Dossier où sont rangés les documents déposés (fiches produit, preuves). Hors du dossier public. */
  dossierDocuments: string;
  /** Tâches planifiées (échéances, rappels, mail du jeudi) : actives sauf en test. */
  planificateur: boolean;
}

function entier(valeur: string | undefined, parDefaut: number): number {
  const nombre = Number(valeur);
  return Number.isInteger(nombre) && nombre > 0 ? nombre : parDefaut;
}

export function lireConfiguration(env: NodeJS.ProcessEnv = process.env): Configuration {
  const production = env.NODE_ENV === 'production';
  const cleSecrete = env.CLE_SECRETE ?? '';
  if (cleSecrete.length < 32) {
    throw new Error('La variable CLE_SECRETE doit contenir au moins 32 caractères aléatoires.');
  }
  const urlApplication = (env.URL_APPLICATION ?? '').replace(/\/+$/, '');
  if (!urlApplication) {
    throw new Error("La variable URL_APPLICATION (adresse publique de l'application) n'est pas renseignée.");
  }
  const smtp = env.SMTP_HOTE
    ? {
        hote: env.SMTP_HOTE,
        port: entier(env.SMTP_PORT, 587),
        securise: env.SMTP_SECURISE === 'true',
        utilisateur: env.SMTP_UTILISATEUR || undefined,
        motDePasse: env.SMTP_MOT_DE_PASSE || undefined,
      }
    : undefined;
  if (production && !smtp) {
    throw new Error("En production, l'envoi des courriels doit être configuré (SMTP_HOTE).");
  }
  const dossierDocuments = env.DOSSIER_DOCUMENTS || (production ? '' : './donnees/documents');
  if (!dossierDocuments) {
    throw new Error('En production, la variable DOSSIER_DOCUMENTS (dossier des documents déposés) doit être renseignée.');
  }
  return {
    production,
    cleSecrete,
    urlApplication,
    courriel: { expediteur: env.COURRIEL_EXPEDITEUR || 'SR CONSEIL <ne-pas-repondre@localhost>', smtp },
    session: {
      dureeHeures: entier(env.SESSION_DUREE_HEURES, 12),
      inactiviteMinutes: entier(env.SESSION_INACTIVITE_MINUTES, 120),
    },
    dossierDocuments,
    planificateur: env.PLANIFICATEUR !== 'non' && env.NODE_ENV !== 'test',
  };
}

export const CONFIGURATION = Symbol('CONFIGURATION');
