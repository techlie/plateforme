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

export interface ReservationSuivie {
  numero: number;
  statut: StatutReservation;
  clientNom: string;
  clientPrenom: string | null;
  numeroContrat: string | null;
  clientPrevendu: boolean;
  motif: string | null;
}

/** Décision du 18 novembre : ce qui reste à faire au mandataire, puis ce qui est fait. */
export const STATUTS_A_FAIRE: readonly StatutReservation[] = ['SOUMISE', 'RENVOYEE', 'LISTE_ATTENTE', 'VALIDEE', 'ECHUE'];
export const STATUTS_FAITS: readonly StatutReservation[] = ['OPERATION_PASSEE', 'ECART_A_JUSTIFIER', 'VERIFIEE'];
export const STATUTS_RECAPITULATIF: readonly StatutReservation[] = [...STATUTS_A_FAIRE, ...STATUTS_FAITS];

/** Où en est la réservation, et ce que le mandataire doit faire. */
export function actionAttendue(r: ReservationSuivie): string {
  switch (r.statut) {
    case 'RENVOYEE':
      return `à corriger : ${r.motif ?? 'voir la plateforme'}`;
    case 'LISTE_ATTENTE':
      return 'en liste d’attente';
    case 'SOUMISE':
      return r.clientPrevendu ? 'en attente de validation par le back-office' : 'client à prévendre';
    case 'VALIDEE':
      return 'validée : opération à passer, puis à déclarer sur la plateforme';
    case 'ECHUE':
      return 'échue : le back-office va vous contacter';
    case 'VERIFIEE':
      return 'vérifiée par la compagnie';
    default:
      return 'opération déclarée, vérification par la compagnie en cours';
  }
}

function ligne(r: ReservationSuivie): string {
  return `- n° ${r.numero} · client ${initialesClient(r.clientNom, r.clientPrenom)} · contrat ${finDeContrat(r.numeroContrat)} : ${actionAttendue(r)}`;
}

/**
 * Récapitulatif personnel du mandataire, sans le nom du client : initiales et fin du contrat.
 * Le jeudi, ce qui reste à faire et ce qui est fait ; le lundi des dernières semaines, ce qui reste.
 * Puis un mot pour avancer et le lien vers la plateforme.
 */
export function lignesMandataire(reservations: ReservationSuivie[], x: { avecFait: boolean; lien: string }): string[] {
  const aFaire = reservations.filter((r) => STATUTS_A_FAIRE.includes(r.statut));
  const faits = reservations.filter((r) => STATUTS_FAITS.includes(r.statut));
  if (aFaire.length === 0 && (faits.length === 0 || !x.avecFait)) {
    return [faits.length ? 'Rien ne vous attend sur cette enveloppe.' : 'Vous n’avez pas de réservation sur cette enveloppe.'];
  }
  const lignes: string[] = [];
  if (aFaire.length) lignes.push('Ce qu’il vous reste à faire :', ...aFaire.map(ligne));
  else lignes.push('Rien ne vous attend sur cette enveloppe.');
  if (x.avecFait && faits.length) lignes.push('', 'Ce qui est fait :', ...faits.map(ligne));
  if (aFaire.length) {
    lignes.push('', `Pour avancer, mettez à jour vos réservations sur la plateforme, avec votre identifiant et votre mot de passe : ${x.lien}`);
  }
  return lignes;
}

/** Le second récapitulatif, le lundi, ne part que dans les dernières semaines avant la date limite interne. */
export function estDansLesRelancesRapprochees(joursRestants: number, seuilJours: number): boolean {
  return joursRestants >= 0 && joursRestants <= seuilJours;
}

/**
 * Alerte au back-office, une fois par enveloppe, à l'approche de la date limite interne : les
 * réservations pas encore assez avancées, par mandataire, pour les appeler et les motiver.
 */
export function lignesAlerteBackOffice(groupes: { mandataire: string; reservations: ReservationSuivie[] }[]): string[] {
  const lignes: string[] = [];
  for (const g of groupes.filter((x) => x.reservations.length)) {
    lignes.push('', `${g.mandataire} :`, ...g.reservations.map(ligne));
  }
  return lignes;
}
