import type { StatutReservation } from '@prisma/client';
import { ajouterJours } from '../../../shared/regles/dates';
import { finDeContrat, initialesClient } from '../../../shared/regles/saisie';

/**
 * Mail hebdomadaire aux équipes (section 7) : un mail par enveloppe ouverte, envoyé le jour et à
 * l'heure fixés, avec un garde-fou qui bloque l'envoi quand une donnée clé paraît incohérente.
 * Fonctions pures.
 */

/** Semaine ISO d'une date de calendrier « AAAA-MM-JJ » : « 2026-W48 ». */
export function semaineIso(date: string): string {
  const t = new Date(`${date}T00:00:00Z`);
  const jour = (t.getUTCDay() + 6) % 7; // lundi = 0
  const jeudi = ajouterJours(date, 3 - jour);
  const annee = Number(jeudi.slice(0, 4));
  const premierJanvier = Date.parse(`${annee}-01-01T00:00:00Z`);
  const numero = Math.floor((Date.parse(`${jeudi}T00:00:00Z`) - premierJanvier) / 86_400_000 / 7) + 1;
  return `${annee}-W${String(numero).padStart(2, '0')}`;
}

/** C'est le moment d'envoyer : le bon jour, à l'heure fixée ou après. */
export function estLeMoment(actuel: { jour: number; heure: string }, jour: number, heure: string): boolean {
  return actuel.jour === jour && actuel.heure >= heure;
}

/** Garde-fou : raison du blocage, ou null si l'envoi peut partir. */
export function raisonDeBlocage(x: { dateLimiteDepassee: boolean; restanteNegative: boolean; depassementAutorise: boolean }): string | null {
  if (x.dateLimiteDepassee) {
    return 'La date limite interne est dépassée alors que l’enveloppe est encore ouverte.';
  }
  if (x.restanteNegative && !x.depassementAutorise) {
    return 'L’enveloppe restante est négative sans dépassement autorisé.';
  }
  return null;
}

export interface ReservationEnAttente {
  numero: number;
  statut: StatutReservation;
  clientNom: string;
  clientPrenom: string | null;
  numeroContrat: string | null;
  clientPrevendu: boolean;
  motif: string | null;
}

/** Action attendue sur une réservation encore non validée. */
export function actionAttendue(r: ReservationEnAttente): string {
  if (r.statut === 'RENVOYEE') return `à corriger : ${r.motif ?? 'voir la plateforme'}`;
  if (r.statut === 'LISTE_ATTENTE') return 'en liste d’attente';
  if (!r.clientPrevendu) return 'client à prévendre';
  return 'en attente de validation par le back-office';
}

/** Les réservations du mandataire, citées sans le nom du client : initiales et fin du contrat. */
export function lignesMandataire(reservations: ReservationEnAttente[]): string[] {
  if (reservations.length === 0) {
    return ['Vous n’avez pas de réservation en attente sur cette enveloppe.'];
  }
  return [
    'Vos réservations encore non validées :',
    ...reservations.map((r) => `- n° ${r.numero} · client ${initialesClient(r.clientNom, r.clientPrenom)} · contrat ${finDeContrat(r.numeroContrat)} : ${actionAttendue(r)}`),
  ];
}
