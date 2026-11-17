import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { CONFIGURATION } from '../../shared/configuration';
import type { Configuration } from '../../shared/configuration';
import { JournalService } from '../../shared/journal/journal.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { dateParis, depuisDateBase, estDepassee, joursEntre, joursRestants, jourEtHeureParis } from '../../shared/regles/dates';
import { EnveloppesService } from './enveloppes.service';
import { NotificationsEnveloppesService } from './notifications.service';
import { soldeGlobale } from './regles/compteurs';
import { estLeMoment, lignesMandataire, raisonDeBlocage, semaineIso } from './regles/emailing';
import { d } from './regles/montants';
import { STATUTS_ACTIFS } from './regles/statuts';

const AUTEUR = 'Plateforme (tâche planifiée)';

/**
 * Tâches qui dépendent de l'heure : fermeture des enveloppes à la date limite interne (23 h 59,
 * heure de Paris), réservations échues, rappels, compte à rebours et mail du jeudi. Chaque tâche
 * peut repasser sans effet double : ce qui est fait est noté en base.
 */
@Injectable()
export class PlanificateurService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Planificateur');
  private minuterie: NodeJS.Timeout | null = null;
  private enCours = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly enveloppes: EnveloppesService,
    private readonly notifications: NotificationsEnveloppesService,
    private readonly journal: JournalService,
    @Inject(CONFIGURATION) private readonly configuration: Configuration,
  ) {}

  onApplicationBootstrap(): void {
    if (this.configuration.planificateur) {
      this.minuterie = setInterval(() => void this.tourner(), 60_000);
      void this.tourner();
    }
  }

  onApplicationShutdown(): void {
    if (this.minuterie) clearInterval(this.minuterie);
  }

  private async tourner(): Promise<void> {
    if (this.enCours) return;
    this.enCours = true;
    try {
      await this.executer(new Date());
    } catch (erreur) {
      this.logger.error('Tâche planifiée en échec', erreur as Error);
    } finally {
      this.enCours = false;
    }
  }

  /** Une passe complète, à l'instant donné. Appelée chaque minute, et directement par les tests. */
  async executer(maintenant: Date): Promise<void> {
    await this.fermerEnveloppes(maintenant);
    await this.marquerEchues(maintenant);
    await this.marquerGlobalesEchues(maintenant);
    await this.rappelerEcheances(maintenant);
    await this.compteARebours(maintenant);
    await this.mailHebdomadaire(maintenant);
  }

  /** À la date limite interne, l'enveloppe se ferme aux réservations et la liste d'attente est close. */
  private async fermerEnveloppes(maintenant: Date) {
    const ouvertes = await this.prisma.enveloppe.findMany({ where: { statut: 'OUVERTE' }, include: { compagnie: { select: { nom: true } } } });
    for (const e of ouvertes.filter((x) => estDepassee(depuisDateBase(x.dateLimiteInterne), maintenant))) {
      await this.prisma.enveloppe.update({ where: { id: e.id }, data: { statut: 'FERMEE', fermeeLe: maintenant } });
      await this.journal.ecrire({ action: 'ENVELOPPE_FERMEE', message: `Enveloppe ${e.nomProduit} fermée aux réservations (date limite interne).`, succes: true, auteur: AUTEUR, cible: e.id });
      const attente = await this.prisma.reservation.findMany({
        where: { enveloppeId: e.id, statut: 'LISTE_ATTENTE' },
        select: { apporteur: { select: { email: true, user: { select: { email: true, actif: true } } } } },
      });
      await this.notifications.envoyer(attente.map((r) => this.notifications.adresseApporteur(r)), `liste d’attente close · ${e.nomProduit}`, [
        'Bonjour,',
        '',
        `La date limite interne de ${e.compagnie.nom} · ${e.nomProduit} est passée : la liste d’attente est close.`,
        'Votre demande n’a pas pu être servie.',
      ]);
    }
  }

  /** À l'échéance, la réservation passe « échue, à traiter » : aucune libération automatique. */
  private async marquerEchues(maintenant: Date) {
    const candidates = await this.prisma.reservation.findMany({
      where: { statut: 'VALIDEE', echeance: { not: null } },
      include: {
        enveloppe: { select: { id: true, nomProduit: true, dateLimiteInterne: true, compagnie: { select: { nom: true } } } },
        apporteur: { select: { email: true, user: { select: { email: true, actif: true } } } },
      },
    });
    for (const r of candidates.filter((x) => estDepassee(depuisDateBase(x.echeance!), maintenant))) {
      await this.prisma.$transaction([
        this.prisma.reservation.update({ where: { id: r.id }, data: { statut: 'ECHUE' } }),
        this.prisma.historiqueReservation.create({
          data: { reservationId: r.id, action: 'ECHEANCE', auteur: AUTEUR, deStatut: 'VALIDEE', versStatut: 'ECHUE', commentaire: 'Échéance passée sans opération déclarée.' },
        }),
      ]);
      await this.notifications.auBackOffice(`réservation échue, à traiter · ${r.enveloppe.nomProduit}`, [
        `La réservation ${this.notifications.designation(r)} est échue sans opération déclarée.`,
        'Contactez le mandataire, consignez le compte rendu, puis prolongez ou libérez.',
        this.notifications.lienReservation(r),
      ]);
    }
  }

  /** Une réservation globale échue dont le solde n'est pas consommé passe « échue, à traiter ». */
  private async marquerGlobalesEchues(maintenant: Date) {
    const actives = await this.prisma.reservationGlobale.findMany({
      where: { statut: 'ACTIVE' },
      include: { apporteur: { select: { nom: true, prenom: true } }, enveloppe: { select: { nomProduit: true } } },
    });
    for (const g of actives.filter((x) => estDepassee(depuisDateBase(x.echeance), maintenant))) {
      const reservations = await this.prisma.reservation.findMany({ where: { reservationGlobaleId: g.id }, select: { statut: true, montantNet: true, montantValide: true, source: true, reservationGlobaleId: true } });
      const { solde } = soldeGlobale(g, reservations);
      await this.prisma.reservationGlobale.update({ where: { id: g.id }, data: { statut: solde.greaterThan(0) ? 'ECHUE' : 'SOLDEE' } });
      if (solde.greaterThan(0)) {
        await this.notifications.auBackOffice(`réservation globale échue · ${g.enveloppe.nomProduit}`, [
          `La réservation globale de ${g.apporteur.prenom} ${g.apporteur.nom} est échue avec un solde non consommé de ${this.notifications.euros(solde)}.`,
          'Contactez l’apporteur, puis prolongez ou libérez le solde.',
        ]);
      }
    }
  }

  /** Rappel au mandataire avant l'échéance, quand le délai du rappel est fixé. */
  private async rappelerEcheances(maintenant: Date) {
    const parametres = await this.prisma.parametresEnveloppes.findFirst();
    if (!parametres?.rappelAvantEcheanceJours) return;
    const jour = dateParis(maintenant);
    const candidates = await this.prisma.reservation.findMany({
      where: { statut: 'VALIDEE', rappelEcheanceEnvoye: false, echeance: { not: null } },
      include: {
        enveloppe: { select: { id: true, nomProduit: true, dateLimiteInterne: true, compagnie: { select: { nom: true } } } },
        apporteur: { select: { email: true, user: { select: { email: true, actif: true } } } },
      },
    });
    for (const r of candidates) {
      const reste = joursEntre(jour, depuisDateBase(r.echeance!));
      if (reste >= 0 && reste <= parametres.rappelAvantEcheanceJours) {
        await this.prisma.reservation.update({ where: { id: r.id }, data: { rappelEcheanceEnvoye: true } });
        await this.notifications.decision(r, `rappel d’échéance · ${r.enveloppe.nomProduit}`, [
          `Votre réservation doit être honorée au plus tard le ${this.notifications.dateLisible(r.echeance!)}.`,
          'Dès l’opération passée, déclarez-la sur la plateforme : les rappels s’arrêtent.',
        ]);
      }
    }
  }

  /** Compte à rebours de la date limite interne (10 et 3 jours avant) aux mandataires dont une réservation n'est pas finalisée. */
  private async compteARebours(maintenant: Date) {
    const parametres = await this.prisma.parametresEnveloppes.findFirst();
    if (!parametres) return;
    const ouvertes = await this.prisma.enveloppe.findMany({ where: { statut: 'OUVERTE' }, include: { compagnie: { select: { nom: true } } } });
    for (const e of ouvertes) {
      const reste = joursRestants(depuisDateBase(e.dateLimiteInterne), maintenant);
      const cle = `rebours:${reste}`;
      if (!parametres.compteAReboursJours.includes(reste) || e.alertesEnvoyees.includes(cle)) continue;
      await this.prisma.enveloppe.update({ where: { id: e.id }, data: { alertesEnvoyees: [...e.alertesEnvoyees, cle] } });
      const concernees = await this.prisma.reservation.findMany({
        where: { enveloppeId: e.id, statut: { in: ['SOUMISE', 'RENVOYEE', 'VALIDEE', 'ECHUE', 'LISTE_ATTENTE'] } },
        select: { apporteur: { select: { email: true, user: { select: { email: true, actif: true } } } } },
      });
      await this.notifications.envoyer(concernees.map((r) => this.notifications.adresseApporteur(r)), `J-${reste} · ${e.nomProduit}`, [
        'Bonjour,',
        '',
        `Plus que ${reste} jour${reste > 1 ? 's' : ''} avant la date limite interne de ${e.compagnie.nom} · ${e.nomProduit} (${this.notifications.dateLisible(e.dateLimiteInterne)}).`,
        'Une de vos réservations n’est pas encore finalisée : consultez votre espace.',
        this.notifications.lienEnveloppe(e.id),
      ]);
    }
  }

  /**
   * Chaque jeudi à 9 h 01, un mail par enveloppe ouverte, une fois le modèle validé par
   * l'administrateur. Garde-fou : une donnée incohérente bloque l'envoi et alerte le back-office.
   * Chaque envoi est archivé : date, destinataires, contenu.
   */
  private async mailHebdomadaire(maintenant: Date) {
    const parametres = await this.prisma.parametresEnveloppes.findFirst();
    if (!parametres?.emailingValideLe || !estLeMoment(jourEtHeureParis(maintenant), parametres.emailingJour, parametres.emailingHeure)) return;
    const semaine = semaineIso(dateParis(maintenant));
    const ouvertes = await this.prisma.enveloppe.findMany({ where: { statut: 'OUVERTE' }, include: { compagnie: { select: { nom: true } }, gammesExclues: { select: { gamme: { select: { nom: true } } } } } });
    for (const e of ouvertes) {
      const envoye = await this.prisma.envoiEmailing.findFirst({ where: { enveloppeId: e.id, semaine, bloque: false } });
      if (envoye) continue;
      const c = await this.enveloppes.compteurs(e.id);
      const depassementAutorise = (await this.prisma.reservation.count({ where: { enveloppeId: e.id, derogations: { has: 'DEPASSEMENT' }, statut: { in: [...STATUTS_ACTIFS] } } })) > 0;
      const blocage = raisonDeBlocage({
        dateLimiteDepassee: estDepassee(depuisDateBase(e.dateLimiteInterne), maintenant),
        restanteNegative: c.restante.isNegative(),
        depassementAutorise,
      });
      const objet = `${e.compagnie.nom} · ${e.nomProduit} · point de la semaine`;
      const commun = [
        'Bonjour,',
        '',
        `${e.compagnie.nom} · ${e.nomProduit}`,
        c.restante.isNegative()
          ? `Enveloppe complète, dépassement autorisé de ${this.notifications.euros(c.depassement)}.`
          : `Enveloppe restante : ${this.notifications.euros(c.restante)}.`,
        `Date limite interne : ${this.notifications.dateLisible(e.dateLimiteInterne)}.`,
        `Taux de commission : ${d(e.tauxCommission).times(100).toString()} % du montant net investi.`,
        `Montant minimum par réservation : ${this.notifications.euros(e.montantMinimum)}.`,
        e.seuilConcentration ? `Concentration : ${d(e.seuilConcentration).times(100).toString()} % de l’encours du client au plus (alerte).` : '',
        e.gammesExclues.length ? `Gammes exclues : ${e.gammesExclues.map((g) => g.gamme.nom).join(', ')}.` : '',
        `Fiche et documents : ${this.notifications.lienEnveloppe(e.id)}`,
        '',
      ].filter((l, i, t) => l !== '' || t[i - 1] !== '');

      if (blocage) {
        // L'envoi est retenté à chaque passe du jour ; l'alerte ne part qu'une fois.
        if (await this.prisma.envoiEmailing.findFirst({ where: { enveloppeId: e.id, semaine, bloque: true } })) continue;
        await this.prisma.envoiEmailing.create({ data: { enveloppeId: e.id, semaine, destinataires: [], objet, contenu: commun.join('\n'), bloque: true, raisonBlocage: blocage } });
        await this.notifications.auBackOffice(`mail du jeudi bloqué · ${e.nomProduit}`, [`Le mail hebdomadaire de ${e.compagnie.nom} · ${e.nomProduit} n’est pas parti.`, `Raison : ${blocage}`, 'Corrigez la donnée en cause : l’envoi repartira à la prochaine passe du jour.']);
        await this.journal.ecrire({ action: 'EMAILING_BLOQUE', message: `Mail hebdomadaire de ${e.nomProduit} bloqué : ${blocage}`, succes: false, auteur: AUTEUR, cible: e.id });
        continue;
      }

      const destinataires = await this.prisma.apporteur.findMany({
        where: { actif: true, user: { actif: true, motDePasse: { not: null }, OR: [{ profil: 'SUPER_ADMINISTRATEUR' }, { modules: { some: { module: 'ENVELOPPES' } } }] } },
        select: { id: true, user: { select: { email: true } } },
      });
      const archive: string[] = [...commun];
      const adresses: string[] = [];
      for (const a of destinataires) {
        const reservations = await this.prisma.reservation.findMany({
          where: { enveloppeId: e.id, apporteurId: a.id, statut: { in: ['SOUMISE', 'RENVOYEE', 'LISTE_ATTENTE'] } },
          select: { numero: true, statut: true, clientNom: true, clientPrenom: true, numeroContrat: true, clientPrevendu: true, motif: { select: { libelle: true } } },
          orderBy: { createdAt: 'asc' },
        });
        const personnel = lignesMandataire(reservations.map((r) => ({ ...r, motif: r.motif?.libelle ?? null })));
        await this.notifications.envoyer([a.user!.email], objet, [...commun, ...personnel]);
        adresses.push(a.user!.email);
        archive.push(`— ${a.user!.email}`, ...personnel);
      }
      await this.prisma.envoiEmailing.create({ data: { enveloppeId: e.id, semaine, destinataires: adresses, objet, contenu: archive.join('\n') } });
      await this.journal.ecrire({ action: 'EMAILING_ENVOYE', message: `Mail hebdomadaire de ${e.nomProduit} envoyé à ${adresses.length} destinataire${adresses.length > 1 ? 's' : ''}.`, succes: true, auteur: AUTEUR, cible: e.id });
    }
  }
}
