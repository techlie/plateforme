/**
 * Dates des enveloppes. Toutes les dates limites s'entendent à 23 h 59, heure de Paris.
 * Une date de calendrier s'écrit « AAAA-MM-JJ ». Fonctions pures : l'heure courante est passée en entrée.
 */

const FORMAT_PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const HEURE_PARIS = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'long',
});

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Date du jour à Paris pour un instant donné. */
export function dateParis(instant: Date): string {
  return FORMAT_PARIS.format(instant);
}

/** Jour de la semaine (1 = lundi … 7 = dimanche) et heure « HH:MM » à Paris. */
export function jourEtHeureParis(instant: Date): { jour: number; heure: string } {
  const parties = HEURE_PARIS.formatToParts(instant);
  const jour = JOURS.indexOf(parties.find((p) => p.type === 'weekday')?.value ?? '') + 1;
  const heure = `${parties.find((p) => p.type === 'hour')?.value}:${parties.find((p) => p.type === 'minute')?.value}`;
  return { jour, heure };
}

export function estDateValide(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const t = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === date;
}

/** Une date limite est dépassée quand le jour à Paris est postérieur : elle vaut jusqu'à 23 h 59. */
export function estDepassee(dateLimite: string, maintenant: Date): boolean {
  return dateParis(maintenant) > dateLimite;
}

export function ajouterJours(date: string, jours: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + jours);
  return t.toISOString().slice(0, 10);
}

/** Nombre de jours de calendrier entre deux dates (b − a). */
export function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Jours restants avant une date limite, vus de Paris ; 0 le jour même. */
export function joursRestants(dateLimite: string, maintenant: Date): number {
  return joursEntre(dateParis(maintenant), dateLimite);
}

/** Ordre imposé à la création : ouverture ≤ date limite interne ≤ fin de commercialisation compagnie ≤ clôture produit. */
export function ordreDesDates(dates: {
  dateOuverture: string;
  dateLimiteInterne: string;
  dateFinCommercialisation: string;
  dateClotureProduit: string;
}): string | null {
  const suite: [string, string][] = [
    ['date d’ouverture', dates.dateOuverture],
    ['date limite interne', dates.dateLimiteInterne],
    ['date de fin de commercialisation compagnie', dates.dateFinCommercialisation],
    ['date de clôture produit', dates.dateClotureProduit],
  ];
  for (let i = 1; i < suite.length; i++) {
    if (suite[i][1] < suite[i - 1][1]) {
      return `La ${suite[i][0]} ne peut pas précéder la ${suite[i - 1][0]}.`;
    }
  }
  return null;
}

/**
 * Échéance d'une réservation = date de validation + délai standard, sans dépasser la date limite
 * interne (section 6.5). Tant que le délai standard n'est pas fixé, l'échéance est la date limite interne.
 */
export function calculerEcheance(dateValidation: string, delaiJours: number | null, dateLimiteInterne: string): string {
  if (delaiJours === null) {
    return dateLimiteInterne;
  }
  const echeance = ajouterJours(dateValidation, delaiJours);
  return echeance < dateLimiteInterne ? echeance : dateLimiteInterne;
}

/** Annulation tardive : faite dans les N derniers jours avant la date limite interne (15 par défaut). */
export function estTardive(dateLimiteInterne: string, maintenant: Date, delaiTardifJours: number): boolean {
  const restants = joursRestants(dateLimiteInterne, maintenant);
  return restants < delaiTardifJours;
}

/** Une date « AAAA-MM-JJ » vers la valeur stockée en base (colonne DATE). */
export function versDateBase(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** La valeur d'une colonne DATE vers « AAAA-MM-JJ ». */
export function depuisDateBase(date: Date): string {
  return date.toISOString().slice(0, 10);
}
