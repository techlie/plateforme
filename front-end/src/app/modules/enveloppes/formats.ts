import { insecable } from '../../shared/nombres';

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const EUROS_RONDS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const POURCENT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 12500.00 » → « 12 500,00 € ». */
export function euros(montant: string | null | undefined): string {
  if (montant === null || montant === undefined || montant === '') return '—';
  return EUROS.format(Number(montant));
}

/** « 588000.00 » → « 588 000 € », pour les grands compteurs. */
export function eurosRonds(montant: string | null | undefined): string {
  if (montant === null || montant === undefined || montant === '') return '—';
  return EUROS_RONDS.format(Number(montant));
}

/** Taux décimal en pourcentage : « 0.02 » → « 2 % ». */
export function pourcent(taux: string | null | undefined): string {
  if (taux === null || taux === undefined || taux === '') return '—';
  return insecable(`${POURCENT.format(Number(taux) * 100)} %`);
}

/** « 2026-11-28 » → « 28 nov. 2026 ». */
export function dateCourte(iso: string | null | undefined, avecAnnee = true): string {
  if (!iso) return '—';
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return `${j} ${MOIS[m - 1]}${avecAnnee ? ` ${a}` : ''}`;
}

/** Date et heure à Paris d'un instant. */
export function dateHeure(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Compte à rebours de la date limite : « J-21 », « Aujourd’hui », « Passée ». */
export function compteARebours(jours: number): string {
  if (jours < 0) return 'Passée';
  if (jours === 0) return 'Aujourd’hui';
  return `J-${jours}`;
}

/** Saisie française d'un montant (« 12 500,5 ») → texte pour le serveur (« 12500.50 »), ou null. */
export function versMontant(saisie: string): string | null {
  const propre = saisie.replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(propre)) return null;
  return Number(propre).toFixed(2);
}

/** Saisie d'un pourcentage (« 1,5 ») → taux décimal pour le serveur (« 0.015 »), ou null. */
export function versTaux(saisie: string): string | null {
  const propre = saisie.replace(/[\s  %]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,4})?$/.test(propre)) return null;
  const valeur = Number(propre);
  if (valeur > 100) return null;
  return String(Math.round(valeur * 1e4) / 1e6);
}

/** Taux décimal du serveur → saisie en pourcentage (« 0.015 » → « 1,5 »). */
export function depuisTaux(taux: string | null | undefined): string {
  if (taux === null || taux === undefined || taux === '') return '';
  return POURCENT.format(Number(taux) * 100);
}

/** Montant du serveur → saisie (« 12500.00 » → « 12 500 »). */
export function depuisMontant(montant: string | null | undefined): string {
  if (montant === null || montant === undefined || montant === '') return '';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(montant));
}

/** Nom du client tel qu'affiché dans l'application (jamais dans un courriel). */
export function nomClient(r: { clientNom: string; clientPrenom: string | null }): string {
  return r.clientPrenom ? `${r.clientPrenom} ${r.clientNom}` : r.clientNom;
}

export function initiales(texte: string): string {
  return texte
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? '')
    .join('');
}

export function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
