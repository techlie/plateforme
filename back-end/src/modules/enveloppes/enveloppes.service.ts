import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CategorieMotif, Prisma, StatutEnveloppe } from '@prisma/client';
import { nomComplet, UtilisateurConnecte } from '../../shared/acces/acces.types';
import { JournalService } from '../../shared/journal/journal.service';
import { calculerEcheance, dateParis, depuisDateBase, estDepassee, joursRestants, ordreDesDates, versDateBase } from '../../shared/regles/dates';
import { cleClient, isinValide } from '../../shared/regles/saisie';
import { ReferentielsService } from '../referentiels/referentiels.service';
import { estAdministrateur, estGestion, estSuperAdministrateur, exigerAdministrateur, exigerGestion } from './acces-enveloppes';
import {
  ClientConfieDto,
  EnveloppeDto,
  LiberationGlobaleDto,
  ModificationEnveloppeDto,
  ModificationMotifDto,
  MotifDto,
  MouvementDto,
  ParametresDto,
  ProlongationGlobaleDto,
  ReservationGlobaleDto,
  StatutProduitDto,
  UpfrontDto,
} from './dto/enveloppes.dto';
import { Db, EnveloppeComplete, EnveloppesRepository } from './enveloppes.repository';
import { NotificationsEnveloppesService } from './notifications.service';
import { calculerCompteurs, Compteurs, seuilsFranchis, soldeGlobale } from './regles/compteurs';
import { d } from './regles/montants';
import { STATUTS_ACTIFS, STATUTS_FINAUX } from './regles/statuts';
import { compteursGestion, compteursMandataire, texteDate, texteMontant, texteTaux } from './sorties';

const STATUTS_VISIBLES_MANDATAIRE: StatutEnveloppe[] = ['OUVERTE', 'FERMEE'];

/**
 * Enveloppes de produits structurés : création, paramétrage, mouvements, réservations
 * globales, clients confiés, paramètres et motifs. Les montants sortent toujours des règles
 * pures de `regles/`, recalculés à chaque affichage.
 */
@Injectable()
export class EnveloppesService {
  constructor(
    private readonly repository: EnveloppesRepository,
    private readonly referentiels: ReferentielsService,
    private readonly journal: JournalService,
    private readonly notifications: NotificationsEnveloppesService,
  ) {}

  private tracer(auteur: UtilisateurConnecte, action: string, message: string, cible: string, details?: Prisma.InputJsonValue) {
    return this.journal.ecrire({ action, message, succes: true, userId: auteur.id, auteur: nomComplet(auteur), cible, details });
  }

  // Paramètres et motifs

  async parametres(db: Db = this.repository.prisma) {
    const p = await this.repository.parametres(db);
    if (!p) {
      throw new UnprocessableEntityException({ code: 'PARAMETRES', message: 'Les paramètres du module ne sont pas initialisés : lancez le script d’initialisation.' });
    }
    return p;
  }

  async lireParametres() {
    const p = await this.parametres();
    return {
      delaiHonorerJours: p.delaiHonorerJours,
      rappelAvantEcheanceJours: p.rappelAvantEcheanceJours,
      seuilEcart: texteTaux(p.seuilEcart),
      seuilEstimationArbitrage: texteTaux(p.seuilEstimationArbitrage),
      delaiAnnulationTardiveJours: p.delaiAnnulationTardiveJours,
      tauxClientsConfiesDefaut: texteTaux(p.tauxClientsConfiesDefaut),
      tauxClientsConfiesAConfirmer: p.tauxClientsConfiesAConfirmer,
      seuilConcentrationDefaut: texteTaux(p.seuilConcentrationDefaut),
      compteAReboursJours: p.compteAReboursJours,
      seuilsRemplissage: p.seuilsRemplissage.map((s) => s.toString()),
      seuilsReelValide: p.seuilsReelValide.map((s) => s.toString()),
      emailingJour: p.emailingJour,
      emailingHeure: p.emailingHeure,
      emailingValideLe: p.emailingValideLe?.toISOString() ?? null,
      emailingValidePar: p.emailingValidePar,
      relancesRapprocheesJours: p.relancesRapprocheesJours,
      emailingJourRapproche: p.emailingJourRapproche,
      alerteBackOfficeJours: p.alerteBackOfficeJours,
      ancienneteAnnulationJours: p.ancienneteAnnulationJours,
      poidsAnnulationAggravee: p.poidsAnnulationAggravee,
    };
  }

  async modifierParametres(dto: ParametresDto, auteur: UtilisateurConnecte) {
    const avant = await this.parametres();
    await this.repository.prisma.parametresEnveloppes.update({
      where: { id: avant.id },
      data: {
        delaiHonorerJours: dto.delaiHonorerJours,
        rappelAvantEcheanceJours: dto.rappelAvantEcheanceJours,
        seuilEcart: dto.seuilEcart,
        seuilEstimationArbitrage: dto.seuilEstimationArbitrage,
        delaiAnnulationTardiveJours: dto.delaiAnnulationTardiveJours,
        tauxClientsConfiesDefaut: dto.tauxClientsConfiesDefaut,
        tauxClientsConfiesAConfirmer: dto.tauxClientsConfiesDefaut !== undefined ? false : undefined,
        seuilConcentrationDefaut: dto.seuilConcentrationDefaut,
        compteAReboursJours: dto.compteAReboursJours,
        emailingJour: dto.emailingJour,
        emailingHeure: dto.emailingHeure,
        relancesRapprocheesJours: dto.relancesRapprocheesJours,
        emailingJourRapproche: dto.emailingJourRapproche,
        alerteBackOfficeJours: dto.alerteBackOfficeJours,
        ancienneteAnnulationJours: dto.ancienneteAnnulationJours,
        poidsAnnulationAggravee: dto.poidsAnnulationAggravee,
      },
    });
    await this.tracer(auteur, 'PARAMETRES_ENVELOPPES', 'Paramètres du module Enveloppes modifiés.', avant.id, {
      avant: { delaiHonorerJours: avant.delaiHonorerJours, rappelAvantEcheanceJours: avant.rappelAvantEcheanceJours, seuilEcart: avant.seuilEcart.toString() },
      demande: JSON.parse(JSON.stringify(dto)),
    });
    return this.lireParametres();
  }

  /** Le modèle du mail hebdomadaire est validé une fois par l'administrateur ; les envois partent ensuite seuls. */
  async validerEmailing(auteur: UtilisateurConnecte) {
    const p = await this.parametres();
    await this.repository.prisma.parametresEnveloppes.update({ where: { id: p.id }, data: { emailingValideLe: new Date(), emailingValidePar: nomComplet(auteur) } });
    await this.tracer(auteur, 'EMAILING_VALIDE', 'Modèle du mail hebdomadaire validé.', p.id);
    return this.lireParametres();
  }

  motifs(categorie?: CategorieMotif) {
    return this.repository.prisma.motif.findMany({ where: categorie ? { categorie } : undefined, orderBy: [{ categorie: 'asc' }, { libelle: 'asc' }] });
  }

  async creerMotif(dto: MotifDto, auteur: UtilisateurConnecte) {
    const libelle = dto.libelle.trim();
    const existe = await this.repository.prisma.motif.findFirst({ where: { categorie: dto.categorie, libelle: { equals: libelle, mode: 'insensitive' } } });
    if (existe) {
      throw new ConflictException({ code: 'EXISTE', message: 'Ce motif existe déjà.' });
    }
    const motif = await this.repository.prisma.motif.create({
      data: {
        categorie: dto.categorie,
        libelle,
        imputabilite: dto.categorie === 'ANNULATION' ? (dto.imputabilite ?? 'NON_IMPUTABLE') : 'NON_IMPUTABLE',
        // Au choix du back-office : il explique toujours son choix.
        commentaireObligatoire: dto.imputabilite === 'AU_CHOIX' ? true : (dto.commentaireObligatoire ?? false),
      },
    });
    await this.tracer(auteur, 'MOTIF_CREE', `Motif « ${libelle} » créé.`, motif.id, { categorie: dto.categorie, imputabilite: motif.imputabilite });
    return motif;
  }

  async modifierMotif(id: string, dto: ModificationMotifDto, auteur: UtilisateurConnecte) {
    const avant = await this.repository.motif(id);
    if (!avant) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Motif introuvable.' });
    }
    const motif = await this.repository.prisma.motif.update({
      where: { id },
      data: {
        libelle: dto.libelle?.trim(),
        imputabilite: avant.categorie === 'ANNULATION' ? dto.imputabilite : undefined,
        commentaireObligatoire: dto.imputabilite === 'AU_CHOIX' ? true : dto.commentaireObligatoire,
        actif: dto.actif,
      },
    });
    await this.tracer(auteur, 'MOTIF_MODIFIE', `Motif « ${motif.libelle} » modifié.`, id, { avant: { libelle: avant.libelle, imputabilite: avant.imputabilite, actif: avant.actif } });
    return motif;
  }

  // Compteurs et vues

  async compteurs(enveloppeId: string, db: Db = this.repository.prisma): Promise<Compteurs> {
    return calculerCompteurs(await this.repository.donneesCompteurs(enveloppeId, db));
  }

  vue(e: EnveloppeComplete, c: Compteurs, u: UtilisateurConnecte, maintenant = new Date()) {
    const gestion = estGestion(u);
    return {
      id: e.id,
      compagnie: { id: e.compagnie.id, nom: e.compagnie.nom, exempleNumeroContrat: e.compagnie.exempleNumeroContrat, aUnFormat: !!e.compagnie.formatNumeroContrat },
      gammes: e.compagnie.gammes,
      nomProduit: e.nomProduit,
      isin: e.isin,
      montantInitial: texteMontant(e.montantInitial),
      dateOuverture: texteDate(e.dateOuverture),
      dateLimiteInterne: texteDate(e.dateLimiteInterne),
      dateFinCommercialisation: texteDate(e.dateFinCommercialisation),
      dateClotureProduit: texteDate(e.dateClotureProduit),
      joursRestants: joursRestants(depuisDateBase(e.dateLimiteInterne), maintenant),
      tauxCommission: texteTaux(e.tauxCommission),
      tauxClientsConfies: texteTaux(e.tauxClientsConfies),
      rendement: e.rendement,
      seuilConcentration: texteTaux(e.seuilConcentration),
      montantMinimum: texteMontant(e.montantMinimum),
      controlePatrimoine: e.controlePatrimoine,
      statut: e.statut,
      gammesExclues: e.gammesExclues.map((g) => g.gamme),
      documents: e.documents.filter((doc) => gestion || doc.categorie !== 'AVENANT_VIERGE'),
      compteurs: gestion ? compteursGestion(c) : compteursMandataire(c),
      // L'upfront n'est jamais envoyé à un autre profil que le super administrateur.
      ...(estSuperAdministrateur(u) ? { upfrontReel: texteTaux(e.upfrontReel) } : {}),
    };
  }

  async lister(u: UtilisateurConnecte) {
    const enveloppes = await this.repository.listerEnveloppes(estGestion(u) ? undefined : { in: STATUTS_VISIBLES_MANDATAIRE });
    return Promise.all(enveloppes.map(async (e) => this.vue(e, await this.compteurs(e.id), u)));
  }

  async enveloppe(id: string, db: Db = this.repository.prisma): Promise<EnveloppeComplete> {
    const e = await this.repository.trouverEnveloppe(id, db);
    if (!e) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Enveloppe introuvable.' });
    }
    return e;
  }

  async detail(id: string, u: UtilisateurConnecte) {
    const e = await this.enveloppe(id);
    if (!estGestion(u) && !STATUTS_VISIBLES_MANDATAIRE.includes(e.statut)) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Enveloppe introuvable.' });
    }
    const c = await this.compteurs(id);
    const vue = this.vue(e, c, u);
    if (!estGestion(u)) {
      return vue;
    }
    const [mouvements, globales, donnees] = await Promise.all([
      this.repository.prisma.mouvementEnveloppe.findMany({ where: { enveloppeId: id }, orderBy: { createdAt: 'asc' } }),
      this.repository.prisma.reservationGlobale.findMany({
        where: { enveloppeId: id },
        include: { apporteur: { select: { id: true, nom: true, prenom: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.repository.donneesCompteurs(id),
    ]);
    return {
      ...vue,
      mouvements: mouvements.map((m) => ({ id: m.id, type: m.type, montant: texteMontant(m.montant), motif: m.motif, auteur: m.auteur, date: m.createdAt.toISOString() })),
      reservationsGlobales: globales.map((g) => {
        const s = soldeGlobale(g, donnees.reservations);
        return {
          id: g.id,
          apporteur: g.apporteur,
          montant: texteMontant(g.montant),
          montantLibere: texteMontant(g.montantLibere),
          consomme: s.consomme.toFixed(2),
          solde: s.solde.toFixed(2),
          motif: g.motif,
          echeance: texteDate(g.echeance),
          statut: g.statut,
          auteur: g.auteur,
        };
      }),
    };
  }

  // Création et paramétrage

  private async verifierGammes(compagnieId: string, gammes: string[]) {
    const compagnie = await this.referentiels.compagnie(compagnieId);
    const connues = new Set(compagnie.gammes.map((g) => g.id));
    if (gammes.some((g) => !connues.has(g))) {
      throw new BadRequestException({ code: 'GAMME', message: 'Une gamme exclue n’appartient pas à cette compagnie.' });
    }
    return compagnie;
  }

  async creer(dto: EnveloppeDto, auteur: UtilisateurConnecte) {
    exigerGestion(auteur);
    const compagnie = await this.verifierGammes(dto.compagnieId, dto.gammesExclues);
    if (!compagnie.actif) {
      throw new BadRequestException({ code: 'COMPAGNIE', message: 'Cette compagnie est inactive.' });
    }
    const ordre = ordreDesDates(dto);
    if (ordre) {
      throw new BadRequestException({ code: 'DATES', message: ordre });
    }
    const isin = dto.isin?.trim().toUpperCase() || null;
    if (isin && !isinValide(isin)) {
      throw new BadRequestException({ code: 'ISIN', message: 'Code ISIN invalide (clé de contrôle comprise).' });
    }
    if (d(dto.montantInitial).lessThanOrEqualTo(0)) {
      throw new BadRequestException({ code: 'MONTANT', message: 'Le montant initial doit être positif.' });
    }
    const e = await this.repository.prisma.enveloppe.create({
      data: {
        compagnieId: dto.compagnieId,
        nomProduit: dto.nomProduit.trim(),
        isin,
        montantInitial: dto.montantInitial,
        dateOuverture: versDateBase(dto.dateOuverture),
        dateLimiteInterne: versDateBase(dto.dateLimiteInterne),
        dateFinCommercialisation: versDateBase(dto.dateFinCommercialisation),
        dateClotureProduit: versDateBase(dto.dateClotureProduit),
        tauxCommission: dto.tauxCommission,
        tauxClientsConfies: dto.tauxClientsConfies,
        rendement: dto.rendement?.trim() || null,
        seuilConcentration: dto.seuilConcentration ?? null,
        montantMinimum: dto.montantMinimum,
        controlePatrimoine: dto.controlePatrimoine ?? false,
        gammesExclues: { create: [...new Set(dto.gammesExclues)].map((gammeId) => ({ gammeId })) },
      },
    });
    await this.tracer(auteur, 'ENVELOPPE_CREEE', `Enveloppe ${e.nomProduit} créée chez ${compagnie.nom}.`, e.id, {
      montantInitial: dto.montantInitial,
      tauxCommission: dto.tauxCommission,
      dateLimiteInterne: dto.dateLimiteInterne,
    });
    return this.detail(e.id, auteur);
  }

  /**
   * En préparation, le back-office et l'administrateur paramètrent librement. Une enveloppe ouverte
   * ne se modifie que par un administrateur, avec motif ; la modification est journalisée et notifiée
   * aux mandataires concernés. Les échéances sont recalculées ; le taux des réservations déjà validées
   * ne change pas.
   */
  async modifier(id: string, dto: ModificationEnveloppeDto, auteur: UtilisateurConnecte) {
    const avant = await this.enveloppe(id);
    if (['CLOTUREE', 'ANNULEE', 'REPORTEE'].includes(avant.statut)) {
      throw new BadRequestException({ code: 'STATUT', message: 'Cette enveloppe ne se modifie plus.' });
    }
    const ouverte = avant.statut !== 'EN_PREPARATION';
    if (ouverte) {
      exigerAdministrateur(auteur);
      if (!dto.motif?.trim()) {
        throw new BadRequestException({ code: 'MOTIF', message: 'Le motif est obligatoire pour modifier une enveloppe ouverte.' });
      }
    } else {
      exigerGestion(auteur);
    }
    if (dto.gammesExclues) {
      await this.verifierGammes(avant.compagnieId, dto.gammesExclues);
    }
    const dates = {
      dateOuverture: dto.dateOuverture ?? depuisDateBase(avant.dateOuverture),
      dateLimiteInterne: dto.dateLimiteInterne ?? depuisDateBase(avant.dateLimiteInterne),
      dateFinCommercialisation: dto.dateFinCommercialisation ?? depuisDateBase(avant.dateFinCommercialisation),
      dateClotureProduit: dto.dateClotureProduit ?? depuisDateBase(avant.dateClotureProduit),
    };
    const ordre = ordreDesDates(dates);
    if (ordre) {
      throw new BadRequestException({ code: 'DATES', message: ordre });
    }
    const isin = dto.isin === undefined ? undefined : dto.isin.trim().toUpperCase() || null;
    if (isin && !isinValide(isin)) {
      throw new BadRequestException({ code: 'ISIN', message: 'Code ISIN invalide (clé de contrôle comprise).' });
    }
    const parametres = await this.parametres();

    await this.repository.transaction(async (tx) => {
      await this.repository.verrouiller(tx, id);
      if (dto.montantInitial !== undefined && d(dto.montantInitial).lessThan(avant.montantInitial)) {
        const c = calculerCompteurs({ ...(await this.repository.donneesCompteurs(id, tx)), montantInitial: dto.montantInitial });
        if (c.restante.isNegative()) {
          throw new BadRequestException({ code: 'MONTANT', message: 'Le montant initial ne peut pas descendre sous ce qui est déjà réservé.' });
        }
      }
      await tx.enveloppe.update({
        where: { id },
        data: {
          nomProduit: dto.nomProduit?.trim(),
          isin,
          montantInitial: dto.montantInitial,
          dateOuverture: dto.dateOuverture ? versDateBase(dto.dateOuverture) : undefined,
          dateLimiteInterne: dto.dateLimiteInterne ? versDateBase(dto.dateLimiteInterne) : undefined,
          dateFinCommercialisation: dto.dateFinCommercialisation ? versDateBase(dto.dateFinCommercialisation) : undefined,
          dateClotureProduit: dto.dateClotureProduit ? versDateBase(dto.dateClotureProduit) : undefined,
          tauxCommission: dto.tauxCommission,
          tauxClientsConfies: dto.tauxClientsConfies,
          rendement: dto.rendement === undefined ? undefined : dto.rendement.trim() || null,
          seuilConcentration: dto.seuilConcentration === undefined ? undefined : dto.seuilConcentration || null,
          montantMinimum: dto.montantMinimum,
          controlePatrimoine: dto.controlePatrimoine,
          // Une date limite repoussée rouvre une enveloppe fermée.
          statut: avant.statut === 'FERMEE' && dto.dateLimiteInterne && !estDepassee(dto.dateLimiteInterne, new Date()) ? 'OUVERTE' : undefined,
        },
      });
      if (dto.gammesExclues) {
        await tx.enveloppeGammeExclue.deleteMany({ where: { enveloppeId: id } });
        await tx.enveloppeGammeExclue.createMany({ data: [...new Set(dto.gammesExclues)].map((gammeId) => ({ enveloppeId: id, gammeId })) });
      }
      // Taux : seules les lignes au taux de l'enveloppe et pas encore figées suivent le nouveau taux.
      if (dto.tauxCommission !== undefined) {
        await tx.reservation.updateMany({ where: { enveloppeId: id, tauxFigeLe: null, origineClient: 'MANDATAIRE' }, data: { tauxCommission: dto.tauxCommission } });
      }
      // Échéances : recalculées sans écourter une prolongation, toujours dans la date limite interne.
      if (dto.dateLimiteInterne) {
        const validees = await tx.reservation.findMany({ where: { enveloppeId: id, statut: 'VALIDEE' }, select: { id: true, valideeLe: true, echeance: true } });
        for (const r of validees) {
          const calcul = calculerEcheance(dateParis(r.valideeLe ?? new Date()), parametres.delaiHonorerJours, dto.dateLimiteInterne);
          const actuelle = r.echeance ? depuisDateBase(r.echeance) : calcul;
          const bornee = actuelle < dto.dateLimiteInterne ? actuelle : dto.dateLimiteInterne;
          await tx.reservation.update({ where: { id: r.id }, data: { echeance: versDateBase(calcul > bornee ? calcul : bornee), rappelEcheanceEnvoye: false } });
        }
      }
    });

    await this.tracer(auteur, 'ENVELOPPE_MODIFIEE', `Enveloppe ${avant.nomProduit} modifiée${ouverte ? ' (ouverte)' : ''}.`, id, {
      motif: dto.motif ?? null,
      avant: {
        montantInitial: avant.montantInitial.toString(),
        dateLimiteInterne: depuisDateBase(avant.dateLimiteInterne),
        tauxCommission: avant.tauxCommission.toString(),
        montantMinimum: avant.montantMinimum.toString(),
        seuilConcentration: avant.seuilConcentration?.toString() ?? null,
      },
      demande: JSON.parse(JSON.stringify(dto)),
    });
    if (ouverte) {
      await this.prevenirMandataires(id, `modification de l’enveloppe ${avant.nomProduit}`, [
        'Bonjour,',
        '',
        `L’enveloppe ${avant.compagnie.nom} · ${avant.nomProduit} a été modifiée par le cabinet.`,
        `Motif : ${dto.motif}`,
        'Consultez la fiche de l’enveloppe pour les nouvelles conditions :',
        this.notifications.lienEnveloppe(id),
      ]);
    }
    return this.detail(id, auteur);
  }

  /** Prévient les apporteurs qui ont une réservation en cours ou en liste d'attente sur l'enveloppe. */
  private async prevenirMandataires(enveloppeId: string, objet: string, lignes: string[]) {
    const reservations = await this.repository.prisma.reservation.findMany({
      where: { enveloppeId, statut: { in: [...STATUTS_ACTIFS, 'LISTE_ATTENTE'] } },
      select: { apporteur: { select: { email: true, user: { select: { email: true, actif: true } } } } },
    });
    await this.notifications.envoyer(
      reservations.map((r) => this.notifications.adresseApporteur(r)),
      objet,
      lignes,
    );
  }

  async ouvrir(id: string, auteur: UtilisateurConnecte) {
    exigerGestion(auteur);
    const e = await this.enveloppe(id);
    if (e.statut !== 'EN_PREPARATION') {
      throw new BadRequestException({ code: 'STATUT', message: 'Seule une enveloppe en préparation peut être ouverte.' });
    }
    if (estDepassee(depuisDateBase(e.dateLimiteInterne), new Date())) {
      throw new BadRequestException({ code: 'DATES', message: 'La date limite interne est déjà passée.' });
    }
    await this.repository.prisma.enveloppe.update({ where: { id }, data: { statut: 'OUVERTE' } });
    await this.tracer(auteur, 'ENVELOPPE_OUVERTE', `Enveloppe ${e.nomProduit} ouverte aux réservations.`, id);
    return this.detail(id, auteur);
  }

  /** Clôture : seulement quand chaque réservation a un statut final et chaque écart un motif. */
  async cloturer(id: string, auteur: UtilisateurConnecte) {
    exigerGestion(auteur);
    const e = await this.enveloppe(id);
    if (e.statut !== 'FERMEE') {
      throw new BadRequestException({ code: 'STATUT', message: 'Seule une enveloppe fermée aux réservations peut être clôturée.' });
    }
    const enCours = await this.repository.prisma.reservation.count({ where: { enveloppeId: id, statut: { notIn: [...STATUTS_FINAUX] } } });
    if (enCours > 0) {
      throw new UnprocessableEntityException({
        code: 'NON_FINALISEE',
        message: `${enCours} réservation${enCours > 1 ? 's n’ont' : ' n’a'} pas encore de statut final (ou un écart reste sans motif).`,
      });
    }
    const globalesActives = await this.repository.prisma.reservationGlobale.count({ where: { enveloppeId: id, statut: { not: 'SOLDEE' } } });
    if (globalesActives > 0) {
      throw new UnprocessableEntityException({ code: 'NON_FINALISEE', message: 'Une réservation globale n’est pas soldée.' });
    }
    await this.repository.prisma.enveloppe.update({ where: { id }, data: { statut: 'CLOTUREE', clotureeLe: new Date() } });
    await this.tracer(auteur, 'ENVELOPPE_CLOTUREE', `Enveloppe ${e.nomProduit} clôturée.`, id);
    return this.detail(id, auteur);
  }

  /**
   * Produit annulé ou reporté par l'émetteur ou la compagnie : les réservations actives sont libérées
   * sans effet sur la fiabilité, et les mandataires sont prévenus.
   */
  async statutProduit(id: string, dto: StatutProduitDto, auteur: UtilisateurConnecte) {
    exigerAdministrateur(auteur);
    const e = await this.enveloppe(id);
    if (['CLOTUREE', 'ANNULEE', 'REPORTEE'].includes(e.statut)) {
      throw new BadRequestException({ code: 'STATUT', message: 'Cette enveloppe est déjà close.' });
    }
    const libelle = dto.statut === 'ANNULEE' ? 'annulé' : 'reporté';
    await this.prevenirMandataires(id, `produit ${libelle} · ${e.nomProduit}`, [
      'Bonjour,',
      '',
      `Le produit ${e.compagnie.nom} · ${e.nomProduit} est ${libelle} par l’émetteur ou la compagnie.`,
      'Vos réservations en cours sont libérées, sans effet sur vos indicateurs.',
      `Motif : ${dto.motif}`,
    ]);
    await this.repository.transaction(async (tx) => {
      await this.repository.verrouiller(tx, id);
      const concernees = await tx.reservation.findMany({
        where: { enveloppeId: id, statut: { in: [...STATUTS_ACTIFS, 'LISTE_ATTENTE'] } },
        select: { id: true, statut: true, signalements: true },
      });
      for (const r of concernees) {
        const versStatut = r.statut === 'LISTE_ATTENTE' ? 'ANNULEE' : 'LIBEREE';
        await tx.reservation.update({
          where: { id: r.id },
          data: { statut: versStatut, signalements: [...new Set([...r.signalements, 'PRODUIT_ANNULE_OU_REPORTE'])], annuleeLe: versStatut === 'ANNULEE' ? new Date() : undefined },
        });
        await this.repository.ecrireHistorique(tx, {
          reservationId: r.id,
          action: 'PRODUIT_ANNULE_OU_REPORTE',
          auteurId: auteur.id,
          auteur: nomComplet(auteur),
          deStatut: r.statut,
          versStatut,
          commentaire: `Produit ${libelle} : ${dto.motif}`,
        });
      }
      await tx.enveloppe.update({ where: { id }, data: { statut: dto.statut } });
    });
    await this.tracer(auteur, dto.statut === 'ANNULEE' ? 'ENVELOPPE_ANNULEE' : 'ENVELOPPE_REPORTEE', `Produit ${e.nomProduit} ${libelle}.`, id, { motif: dto.motif });
    return this.detail(id, auteur);
  }

  /** Rallonge ou restitution, par l'administrateur. Une restitution ne descend pas sous le montant déjà retenu. */
  async mouvement(id: string, dto: MouvementDto, auteur: UtilisateurConnecte) {
    exigerAdministrateur(auteur);
    const e = await this.enveloppe(id);
    if (['CLOTUREE', 'ANNULEE', 'REPORTEE'].includes(e.statut)) {
      throw new BadRequestException({ code: 'STATUT', message: 'Cette enveloppe est close.' });
    }
    if (d(dto.montant).lessThanOrEqualTo(0)) {
      throw new BadRequestException({ code: 'MONTANT', message: 'Le montant doit être positif.' });
    }
    await this.repository.transaction(async (tx) => {
      await this.repository.verrouiller(tx, id);
      if (dto.type === 'RESTITUTION') {
        const c = calculerCompteurs(await this.repository.donneesCompteurs(id, tx));
        if (d(dto.montant).greaterThan(c.restante)) {
          throw new UnprocessableEntityException({ code: 'RESTITUTION', message: 'Une restitution ne peut pas descendre sous le montant déjà réservé.' });
        }
      }
      await tx.mouvementEnveloppe.create({ data: { enveloppeId: id, type: dto.type, montant: dto.montant, motif: dto.motif.trim(), auteurId: auteur.id, auteur: nomComplet(auteur) } });
    });
    await this.tracer(auteur, dto.type === 'RALLONGE' ? 'RALLONGE' : 'RESTITUTION', `${dto.type === 'RALLONGE' ? 'Rallonge' : 'Restitution'} de ${dto.montant} € sur ${e.nomProduit}.`, id, { motif: dto.motif });
    if (dto.type === 'RALLONGE') {
      await this.signalerMontantLibere(id, 'une rallonge');
    }
    return this.detail(id, auteur);
  }

  /** Dès qu'un montant se libère alors qu'une liste d'attente existe, le back-office la reçoit. */
  async signalerMontantLibere(enveloppeId: string, origine: string) {
    const attente = await this.repository.prisma.reservation.findMany({
      where: { enveloppeId, statut: 'LISTE_ATTENTE' },
      include: { enveloppe: { select: { id: true, nomProduit: true, dateLimiteInterne: true, compagnie: { select: { nom: true } } } }, apporteur: { select: { email: true, user: { select: { email: true, actif: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    if (attente.length === 0) {
      return;
    }
    const c = await this.compteurs(enveloppeId);
    await this.notifications.auBackOffice(`montant libéré · liste d’attente · ${attente[0].enveloppe.nomProduit}`, [
      `Un montant vient de se libérer (${origine}) sur ${attente[0].enveloppe.compagnie.nom} · ${attente[0].enveloppe.nomProduit}.`,
      `Enveloppe restante : ${this.notifications.euros(c.restante)}.`,
      'Liste d’attente, par ordre d’arrivée :',
      ...attente.map((r, i) => `${i + 1}. ${this.notifications.designation(r)}`),
    ]);
  }

  /** Alerte au franchissement des seuils de remplissage (80 %, 100 %) et du réel validé (95 %, 100 %). */
  async verifierSeuils(enveloppeId: string) {
    const [e, c, p] = await Promise.all([this.enveloppe(enveloppeId), this.compteurs(enveloppeId), this.parametres()]);
    const nouveaux: string[] = [];
    for (const s of seuilsFranchis(c.tauxRemplissage, p.seuilsRemplissage)) {
      if (!e.alertesEnvoyees.includes(`remplissage:${s}`)) nouveaux.push(`remplissage:${s}`);
    }
    for (const s of seuilsFranchis(c.tauxReel, p.seuilsReelValide)) {
      if (!e.alertesEnvoyees.includes(`reel:${s}`)) nouveaux.push(`reel:${s}`);
    }
    if (c.depassement.greaterThan(0) && !e.alertesEnvoyees.includes(`depassement:${c.depassement.toFixed(2)}`)) {
      nouveaux.push(`depassement:${c.depassement.toFixed(2)}`);
    }
    if (nouveaux.length === 0) {
      return;
    }
    await this.repository.prisma.enveloppe.update({ where: { id: enveloppeId }, data: { alertesEnvoyees: [...e.alertesEnvoyees, ...nouveaux] } });
    const lignes = nouveaux.map((n) => {
      const [type, valeur] = n.split(':');
      const pct = `${d(valeur).times(100).toDecimalPlaces(0).toString()} %`;
      if (type === 'remplissage') return `Enveloppe restante : remplissage de ${pct} atteint.`;
      if (type === 'reel') return `Réel validé par la compagnie : ${pct} de l’enveloppe totale atteint.`;
      return `Enveloppe complète, dépassement autorisé de ${this.notifications.euros(valeur)} : aucune rallonge ne le couvre encore.`;
    });
    await this.notifications.auBackOfficeEtAdministrateurs(`alerte de remplissage · ${e.nomProduit}`, [
      `${e.compagnie.nom} · ${e.nomProduit}`,
      ...lignes,
      `Enveloppe totale : ${this.notifications.euros(c.enveloppeTotale)} · restante : ${this.notifications.euros(c.restante)} · réel validé : ${this.notifications.euros(c.reelValide)}.`,
    ]);
  }

  /** Upfront attendu de la compagnie : saisi et vu des seuls super administrateurs. */
  async upfront(id: string, dto: UpfrontDto, auteur: UtilisateurConnecte) {
    if (!estSuperAdministrateur(auteur)) {
      throw new ForbiddenException({ code: 'PROFIL', message: 'Réservé aux super administrateurs.' });
    }
    const e = await this.enveloppe(id);
    await this.repository.prisma.enveloppe.update({ where: { id }, data: { upfrontReel: dto.taux || null } });
    await this.tracer(auteur, 'UPFRONT_SAISI', `Upfront de ${e.nomProduit} saisi.`, id);
    return this.detail(id, auteur);
  }

  // Réservations globales

  async creerGlobale(enveloppeId: string, dto: ReservationGlobaleDto, auteur: UtilisateurConnecte) {
    exigerGestion(auteur);
    const e = await this.enveloppe(enveloppeId);
    if (e.statut !== 'OUVERTE') {
      throw new BadRequestException({ code: 'STATUT', message: 'L’enveloppe n’est pas ouverte.' });
    }
    const apporteur = await this.referentiels.apporteur(dto.apporteurId);
    if (!apporteur.habiliteReservationGlobale || !apporteur.actif) {
      throw new ForbiddenException({ code: 'HABILITATION', message: 'Cet apporteur n’est pas habilité aux réservations globales.' });
    }
    if (apporteur.compte?.id === auteur.id) {
      throw new ForbiddenException({ code: 'PROPRE_PRODUCTION', message: 'Une réservation globale pour vous-même est posée par le back-office ou un autre administrateur.' });
    }
    if (dto.echeance > depuisDateBase(e.dateLimiteInterne)) {
      throw new BadRequestException({ code: 'ECHEANCE', message: 'L’échéance ne peut pas dépasser la date limite interne.' });
    }
    const globale = await this.repository.transaction(async (tx) => {
      await this.repository.verrouiller(tx, enveloppeId);
      const c = calculerCompteurs(await this.repository.donneesCompteurs(enveloppeId, tx));
      if (d(dto.montant).greaterThan(c.restante)) {
        throw new UnprocessableEntityException({ code: 'DEPASSEMENT', message: `Le montant dépasse l’enveloppe restante (${this.notifications.euros(c.restante)}).` });
      }
      return tx.reservationGlobale.create({
        data: {
          enveloppeId,
          apporteurId: dto.apporteurId,
          montant: dto.montant,
          motif: dto.motif.trim(),
          echeance: versDateBase(dto.echeance),
          auteurId: auteur.id,
          auteur: nomComplet(auteur),
        },
      });
    });
    await this.tracer(auteur, 'RESERVATION_GLOBALE_CREEE', `Réservation globale de ${dto.montant} € pour ${nomComplet(apporteur)} sur ${e.nomProduit}.`, globale.id, { motif: dto.motif });
    await this.notifications.auBackOfficeEtAdministrateurs(`réservation globale · ${e.nomProduit}`, [
      `Réservation globale posée par ${nomComplet(auteur)} pour ${nomComplet(apporteur)} : ${this.notifications.euros(dto.montant)}.`,
      `Motif : ${dto.motif}`,
      `Échéance : ${this.notifications.dateLisible(dto.echeance)}.`,
    ]);
    await this.verifierSeuils(enveloppeId);
    return this.detail(enveloppeId, auteur);
  }

  private async globale(id: string) {
    const g = await this.repository.prisma.reservationGlobale.findUnique({ where: { id }, include: { apporteur: true, enveloppe: { select: { id: true, nomProduit: true } } } });
    if (!g) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Réservation globale introuvable.' });
    }
    return g;
  }

  async libererGlobale(id: string, dto: LiberationGlobaleDto, auteur: UtilisateurConnecte) {
    exigerGestion(auteur);
    const g = await this.globale(id);
    await this.repository.transaction(async (tx) => {
      await this.repository.verrouiller(tx, g.enveloppeId);
      const donnees = await this.repository.donneesCompteurs(g.enveloppeId, tx);
      const { solde } = soldeGlobale(g, donnees.reservations);
      if (d(dto.montant).lessThanOrEqualTo(0) || d(dto.montant).greaterThan(solde)) {
        throw new UnprocessableEntityException({ code: 'SOLDE', message: `Le montant doit être positif et ne pas dépasser le solde (${this.notifications.euros(solde)}).` });
      }
      const libere = d(g.montantLibere).plus(dto.montant);
      await tx.reservationGlobale.update({
        where: { id },
        data: { montantLibere: libere, statut: d(dto.montant).equals(solde) ? 'SOLDEE' : g.statut },
      });
    });
    await this.tracer(auteur, 'RESERVATION_GLOBALE_LIBEREE', `${dto.montant} € libérés de la réservation globale de ${nomComplet(g.apporteur)}.`, id, { motif: dto.motif });
    await this.notifications.auBackOfficeEtAdministrateurs(`réservation globale modifiée · ${g.enveloppe.nomProduit}`, [
      `${nomComplet(auteur)} a libéré ${this.notifications.euros(dto.montant)} de la réservation globale de ${nomComplet(g.apporteur)}.`,
      `Motif : ${dto.motif}`,
    ]);
    await this.signalerMontantLibere(g.enveloppeId, 'une réservation globale');
    return this.detail(g.enveloppeId, auteur);
  }

  async prolongerGlobale(id: string, dto: ProlongationGlobaleDto, auteur: UtilisateurConnecte) {
    exigerGestion(auteur);
    const g = await this.globale(id);
    const e = await this.enveloppe(g.enveloppeId);
    if (g.statut === 'SOLDEE') {
      throw new BadRequestException({ code: 'STATUT', message: 'Cette réservation globale est soldée.' });
    }
    if (dto.echeance > depuisDateBase(e.dateLimiteInterne) || estDepassee(dto.echeance, new Date())) {
      throw new BadRequestException({ code: 'ECHEANCE', message: 'La nouvelle échéance doit être à venir et dans la date limite interne.' });
    }
    await this.repository.prisma.reservationGlobale.update({ where: { id }, data: { echeance: versDateBase(dto.echeance), statut: 'ACTIVE' } });
    await this.tracer(auteur, 'RESERVATION_GLOBALE_PROLONGEE', `Réservation globale de ${nomComplet(g.apporteur)} prolongée.`, id, { echeance: dto.echeance, compteRendu: dto.compteRendu });
    return this.detail(g.enveloppeId, auteur);
  }

  /** Réservations globales qu'un apporteur peut utiliser comme source sur une enveloppe. */
  async globalesDisponibles(enveloppeId: string, apporteurId: string) {
    const [globales, donnees] = await Promise.all([
      this.repository.prisma.reservationGlobale.findMany({ where: { enveloppeId, apporteurId, statut: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }),
      this.repository.donneesCompteurs(enveloppeId),
    ]);
    return globales.map((g) => {
      const s = soldeGlobale(g, donnees.reservations);
      return { id: g.id, montant: texteMontant(g.montant), consomme: s.consomme.toFixed(2), solde: s.solde.toFixed(2), echeance: texteDate(g.echeance) };
    });
  }

  // Clients confiés

  async confier(enveloppeId: string, dto: ClientConfieDto, auteur: UtilisateurConnecte) {
    exigerAdministrateur(auteur);
    const e = await this.enveloppe(enveloppeId);
    if (!['EN_PREPARATION', 'OUVERTE'].includes(e.statut)) {
      throw new BadRequestException({ code: 'STATUT', message: 'L’enveloppe n’accepte plus de clients confiés.' });
    }
    const apporteur = await this.referentiels.apporteur(dto.apporteurId);
    if (!apporteur.actif) {
      throw new BadRequestException({ code: 'APPORTEUR', message: 'Cet apporteur est inactif.' });
    }
    const cle = cleClient(dto.clientNom, dto.clientPrenom ?? null);
    const deja = await this.repository.prisma.clientConfie.findMany({ where: { enveloppeId, statut: { not: 'RETIRE' } }, select: { clientNom: true, clientPrenom: true } });
    if (deja.some((c) => cleClient(c.clientNom, c.clientPrenom) === cle)) {
      throw new ConflictException({ code: 'DEJA_CONFIE', message: 'Ce client est déjà confié sur cette enveloppe.' });
    }
    // Décision du 18 novembre : le taux est celui de la convention de l'apporteur ; à défaut,
    // celui de l'enveloppe. L'administrateur peut encore le saisir, et c'est tracé.
    const convention = dto.taux ? null : await this.referentiels.tauxConvention(dto.apporteurId, dateParis(new Date()));
    const taux = dto.taux ?? convention?.taux ?? e.tauxClientsConfies.toString();
    const origineTaux = dto.taux ? 'SAISI' : convention ? 'CONVENTION' : 'ENVELOPPE';
    const confie = await this.repository.prisma.clientConfie.create({
      data: {
        enveloppeId,
        apporteurId: dto.apporteurId,
        typeClient: dto.typeClient,
        clientNom: dto.clientNom.trim(),
        clientPrenom: dto.clientPrenom?.trim() || null,
        numeroContrat: dto.numeroContrat?.replace(/\s+/g, '') || null,
        taux,
        auteurId: auteur.id,
        auteur: nomComplet(auteur),
      },
    });
    // Journal : qui a confié quel client à qui, à quelle date et à quel taux.
    await this.tracer(auteur, 'CLIENT_CONFIE', `Client confié à ${nomComplet(apporteur)} sur ${e.nomProduit}, au taux de ${d(taux).times(100).toString()} %.`, confie.id, {
      enveloppeId,
      apporteurId: dto.apporteurId,
      taux,
      origineTaux,
      conventionId: convention?.conventionId ?? null,
    });
    const adresse = apporteur.compte ? apporteur.compte.email : apporteur.email;
    await this.notifications.envoyer([adresse], `client confié · ${e.nomProduit}`, [
      'Bonjour,',
      '',
      `Le cabinet vous confie un client sur ${e.compagnie.nom} · ${e.nomProduit}, au taux de ${d(taux).times(100).toString()} %.`,
      'Retrouvez-le dans votre espace Enveloppes, rubrique « Clients confiés ».',
    ]);
    return confie;
  }

  async retirerConfie(id: string, auteur: UtilisateurConnecte) {
    exigerAdministrateur(auteur);
    const c = await this.repository.prisma.clientConfie.findUnique({ where: { id } });
    if (!c) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Client confié introuvable.' });
    }
    if (c.statut !== 'CONFIE') {
      throw new BadRequestException({ code: 'STATUT', message: 'Le client a déjà accepté : la réservation suit son cours.' });
    }
    await this.repository.prisma.clientConfie.update({ where: { id }, data: { statut: 'RETIRE' } });
    await this.tracer(auteur, 'CLIENT_CONFIE_RETIRE', 'Affectation d’un client confié retirée.', id);
  }

  async clientsConfies(u: UtilisateurConnecte, enveloppeId?: string) {
    const where: Prisma.ClientConfieWhereInput = { enveloppeId, statut: { not: 'RETIRE' } };
    if (!estAdministrateur(u) && u.profil !== 'BACK_OFFICE') {
      const moi = await this.referentiels.apporteurDeCompte(u.id);
      if (!moi) return [];
      where.apporteurId = moi.id;
    }
    const liste = await this.repository.prisma.clientConfie.findMany({
      where,
      include: {
        apporteur: { select: { id: true, nom: true, prenom: true } },
        enveloppe: { select: { id: true, nomProduit: true, statut: true, compagnie: { select: { nom: true } } } },
        reservation: { select: { id: true, numero: true, statut: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return liste.map((c) => ({
      id: c.id,
      enveloppe: c.enveloppe,
      apporteur: c.apporteur,
      typeClient: c.typeClient,
      clientNom: c.clientNom,
      clientPrenom: c.clientPrenom,
      numeroContrat: c.numeroContrat,
      taux: texteTaux(c.taux),
      statut: c.statut,
      reservation: c.reservation,
      auteur: c.auteur,
      date: c.createdAt.toISOString(),
    }));
  }
}
