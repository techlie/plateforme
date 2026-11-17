import { Injectable, Logger } from '@nestjs/common';
import type { Profil } from '@prisma/client';
import { CourrielService } from '../../shared/courriel/courriel.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { depuisDateBase } from '../../shared/regles/dates';
import { finDeContrat, initialesClient } from '../../shared/regles/saisie';
import { LIBELLES_STATUTS } from './regles/statuts';

/** Ce qu'un courriel peut dire d'une réservation : jamais le nom complet du client. */
export interface ReservationNotifiee {
  id: string;
  numero: number;
  clientNom: string;
  clientPrenom: string | null;
  numeroContrat: string | null;
  montantNet: { toFixed(n: number): string };
  statut: keyof typeof LIBELLES_STATUTS;
  enveloppe: { id: string; nomProduit: string; dateLimiteInterne: Date; compagnie: { nom: string } };
  apporteur: { email: string | null; user: { email: string; actif: boolean } | null };
}

function euros(m: { toFixed(n: number): string } | string): string {
  const n = Number(typeof m === 'string' ? m : m.toFixed(2));
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function dateLisible(date: Date | string): string {
  const iso = typeof date === 'string' ? date : depuisDateBase(date);
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

/**
 * Notifications du module Enveloppes, toutes par courriel en V1 (section 7). Une panne d'envoi
 * est consignée sans annuler l'action déjà faite.
 */
@Injectable()
export class NotificationsEnveloppesService {
  private readonly logger = new Logger('Notifications');

  constructor(
    private readonly prisma: PrismaService,
    private readonly courriel: CourrielService,
  ) {}

  /** Une réservation telle qu'un courriel peut la citer. */
  designation(r: ReservationNotifiee): string {
    return `n° ${r.numero} · client ${initialesClient(r.clientNom, r.clientPrenom)} · contrat ${finDeContrat(r.numeroContrat)} · ${euros(r.montantNet)}`;
  }

  lienReservation(r: { id: string }): string {
    return this.courriel.lien(`/enveloppes/reservations/${r.id}`);
  }

  lienEnveloppe(id: string): string {
    return this.courriel.lien(`/enveloppes/${id}`);
  }

  adresseApporteur(r: Pick<ReservationNotifiee, 'apporteur'>): string | null {
    if (r.apporteur.user) {
      return r.apporteur.user.actif ? r.apporteur.user.email : null;
    }
    return r.apporteur.email;
  }

  private async adressesProfils(profils: Profil[]): Promise<string[]> {
    const comptes = await this.prisma.user.findMany({
      where: { actif: true, profil: { in: profils }, motDePasse: { not: null } },
      select: { email: true, profil: true, modules: { select: { module: true } } },
    });
    return comptes.filter((c) => c.profil === 'SUPER_ADMINISTRATEUR' || c.modules.some((m) => m.module === 'ENVELOPPES')).map((c) => c.email);
  }

  backOffice(): Promise<string[]> {
    return this.adressesProfils(['BACK_OFFICE']);
  }

  administrateurs(): Promise<string[]> {
    return this.adressesProfils(['ADMINISTRATEUR', 'SUPER_ADMINISTRATEUR']);
  }

  async envoyer(destinataires: (string | null)[], objet: string, lignes: string[]): Promise<void> {
    const uniques = [...new Set(destinataires.filter((a): a is string => !!a))];
    for (const a of uniques) {
      try {
        await this.courriel.envoyerMessage(a, objet, lignes);
      } catch (erreur) {
        this.logger.error(`Envoi impossible : ${objet}`, erreur as Error);
      }
    }
  }

  async reservationSoumise(r: ReservationNotifiee): Promise<void> {
    const entete = `${r.enveloppe.compagnie.nom} · ${r.enveloppe.nomProduit}`;
    await this.envoyer([this.adresseApporteur(r)], `réservation reçue (${r.statut === 'LISTE_ATTENTE' ? 'liste d’attente' : 'à valider'})`, [
      'Bonjour,',
      '',
      `Votre réservation sur ${entete} est bien reçue : ${this.designation(r)}.`,
      r.statut === 'LISTE_ATTENTE' ? 'L’enveloppe est pleine : la demande est inscrite en liste d’attente.' : 'Elle est en attente de validation par le back-office.',
      `Date limite interne : ${dateLisible(r.enveloppe.dateLimiteInterne)}.`,
      this.lienReservation(r),
    ]);
    await this.envoyer(await this.backOffice(), `réservation à traiter · ${r.enveloppe.nomProduit}`, [
      `Nouvelle réservation sur ${entete} : ${this.designation(r)}.`,
      `Statut : ${LIBELLES_STATUTS[r.statut]}.`,
      this.lienReservation(r),
    ]);
  }

  async decision(r: ReservationNotifiee, objet: string, lignes: string[]): Promise<void> {
    await this.envoyer([this.adresseApporteur(r)], objet, [
      'Bonjour,',
      '',
      `${r.enveloppe.compagnie.nom} · ${r.enveloppe.nomProduit} · ${this.designation(r)}`,
      ...lignes,
      this.lienReservation(r),
    ]);
  }

  async auBackOffice(objet: string, lignes: string[]): Promise<void> {
    await this.envoyer(await this.backOffice(), objet, lignes);
  }

  async auBackOfficeEtAdministrateurs(objet: string, lignes: string[]): Promise<void> {
    await this.envoyer([...(await this.backOffice()), ...(await this.administrateurs())], objet, lignes);
  }

  euros = euros;
  dateLisible = dateLisible;
}
