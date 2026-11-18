import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CategorieMotif, ImputabiliteMotif, ModeArbitrage, Prisma, StatutReservation, TypeClient, TypeOperation } from '@prisma/client';
import { createHash } from 'node:crypto';
import { nomComplet, UtilisateurConnecte } from '../../shared/acces/acces.types';
import { JournalService } from '../../shared/journal/journal.service';
import { calculerEcheance, dateParis, depuisDateBase, estDepassee, estTardive, versDateBase } from '../../shared/regles/dates';
import { cleClient, isinValide, nettoyerNumeroContrat } from '../../shared/regles/saisie';
import { ReferentielsService } from '../referentiels/referentiels.service';
import { estAdministrateur, estGestion, estSuperAdministrateur, exigerAdministrateur, exigerGestion, interdireSurSaPropreReservation } from './acces-enveloppes';
import {
  AnnulationDto,
  DecisionDto,
  DeclarationOperationDto,
  DerogationDto,
  EntiteReservationDto,
  FiltreReservationsDto,
  JustificationEcartDto,
  ModificationReservationDto,
  PatrimoineDto,
  ReservationDto,
  ServiceAttenteDto,
  TauxDto,
  TraitementEcheanceDto,
  VerificationDto,
} from './dto/reservations.dto';
import { EnveloppesService } from './enveloppes.service';
import { ficheAvenantPdf } from './fiche-avenant';
import { Db, EnveloppeComplete, EnveloppesRepository, ReservationComplete } from './enveloppes.repository';
import { NotificationsEnveloppesService } from './notifications.service';
import { calculerCompteurs, montantRetenu, soldeGlobale } from './regles/compteurs';
import { Constat, controlerReservation, DEROGATIONS, ResultatControle } from './regles/controles';
import { calculerFiabilite } from './regles/fiabilite';
import { ancienneteJours, imputabiliteRetenue, poidsAnnulation } from './regles/annulation';
import { arrondirAuCentime, commission, d, Decimal, montantNet, part, somme, ZERO } from './regles/montants';
import { LIBELLES_STATUTS, STATUTS_ACTIFS, STATUTS_APRES_OPERATION, STATUTS_AVANT_OPERATION, estVerifie } from './regles/statuts';
import { texteDate, texteMontant, texteTaux } from './sorties';

type Apporteur = Awaited<ReturnType<ReferentielsService['apporteur']>>;

/** Saisie normalisée d'une réservation, commune à la création et à la modification. */
interface Saisie {
  typeOperation: TypeOperation;
  typeClient: TypeClient;
  clientNom: string;
  clientPrenom: string | null;
  numeroContrat: string | null;
  numeroDemande: string | null;
  montantBrut: string;
  tauxFrais: string;
  clientPrevendu: boolean;
  encoursClient: string | null;
  codeApporteurId: string | null;
  gammeId: string | null;
  modeArbitrage: ModeArbitrage | null;
  pourcentageArbitrage: string | null;
  valeurContrat: string | null;
  /** Une ligne se saisit en montant, ou en pourcentage de l'encours du contrat. */
  fonds: { fondsId: string | null; nom: string; isin: string | null; montant: string | null; pourcentage: string | null }[];
  reservationGlobaleId: string | null;
}

/** Ce que reçoit la normalisation : une demande, ou une réservation existante complétée par une demande. */
type EntreeSaisie = {
  [K in Exclude<keyof Saisie, 'fonds'>]?: Saisie[K] | undefined;
} & Pick<Saisie, 'typeOperation' | 'typeClient' | 'clientNom' | 'montantBrut' | 'tauxFrais' | 'clientPrevendu'> & {
  fonds?: { fondsId?: string | null; nom: string; isin?: string | null; montant?: string | null; pourcentage?: string | null }[];
};

interface Preparation {
  controle: ResultatControle;
  net: Decimal;
  codeApporteurId: string | null;
  restante: Decimal;
  fonds: { fondsId: string | null; nom: string; isin: string | null; montant: string; pourcentage: string | null; horsReferentiel: boolean }[];
}

/** Statuts où le mandataire peut encore modifier sa réservation. */
const STATUTS_MODIFIABLES: StatutReservation[] = ['SOUMISE', 'RENVOYEE', 'LISTE_ATTENTE', 'VALIDEE', 'ECHUE'];

/** Champs qui figurent sur l'avenant : les modifier rend l'avenant précédent périmé. */
const CHAMPS_AVENANT: (keyof Saisie)[] = ['clientNom', 'clientPrenom', 'numeroContrat', 'montantBrut', 'tauxFrais', 'codeApporteurId', 'modeArbitrage', 'pourcentageArbitrage', 'fonds'];

/**
 * Réservations : saisie avec contrôles, cycle de vie (section 4), vérification compagnie, liste
 * d'attente, fiabilité et export. Toute action laisse une ligne dans l'historique de la réservation.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly repository: EnveloppesRepository,
    private readonly enveloppes: EnveloppesService,
    private readonly referentiels: ReferentielsService,
    private readonly journal: JournalService,
    private readonly notifications: NotificationsEnveloppesService,
  ) {}

  // Outils

  private tracer(auteur: UtilisateurConnecte, action: string, message: string, cible: string, details?: Prisma.InputJsonValue) {
    return this.journal.ecrire({ action, message, succes: true, userId: auteur.id, auteur: nomComplet(auteur), cible, details });
  }

  private historique(db: Db, r: { id: string; statut: StatutReservation }, u: UtilisateurConnecte, action: string, versStatut: StatutReservation | null, commentaire?: string | null, details?: Prisma.InputJsonValue) {
    return this.repository.ecrireHistorique(db, {
      reservationId: r.id,
      action,
      auteurId: u.id,
      auteur: nomComplet(u),
      deStatut: r.statut,
      versStatut,
      commentaire,
      details,
    });
  }

  private async reservation(id: string, db: Db = this.repository.prisma): Promise<ReservationComplete> {
    const r = await this.repository.trouverReservation(id, db);
    if (!r) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Réservation introuvable.' });
    }
    return r;
  }

  private estApporteur(r: ReservationComplete, u: UtilisateurConnecte): boolean {
    return r.apporteur.userId === u.id;
  }

  /** Le mandataire ne voit que ses réservations ; le filtrage se fait ici, côté serveur. */
  private async lisible(id: string, u: UtilisateurConnecte): Promise<ReservationComplete> {
    const r = await this.reservation(id);
    if (!estGestion(u) && !this.estApporteur(r, u)) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Réservation introuvable.' });
    }
    return r;
  }

  /** Action permise à l'apporteur sur sa réservation, et au back-office. */
  private async modifiable(id: string, u: UtilisateurConnecte): Promise<ReservationComplete> {
    return this.lisible(id, u);
  }

  /** Décision réservée au back-office et aux administrateurs, jamais sur sa propre production. */
  private async decidable(id: string, u: UtilisateurConnecte, db: Db = this.repository.prisma): Promise<ReservationComplete> {
    exigerGestion(u);
    const r = await this.reservation(id, db);
    interdireSurSaPropreReservation(u, r.apporteur.userId);
    return r;
  }

  private exigerStatut(r: { statut: StatutReservation }, permis: readonly StatutReservation[], action: string) {
    if (!permis.includes(r.statut)) {
      throw new BadRequestException({ code: 'STATUT', message: `Impossible de ${action} une réservation au statut « ${LIBELLES_STATUTS[r.statut]} ».` });
    }
  }

  private async motifValable(motifId: string, categorie: CategorieMotif, commentaire?: string) {
    const motif = await this.repository.motif(motifId);
    if (!motif || !motif.actif || motif.categorie !== categorie) {
      throw new BadRequestException({ code: 'MOTIF', message: 'Motif inconnu pour cette action.' });
    }
    // Un motif au choix du back-office est contrôlé à part : son commentaire explique le choix.
    if (motif.imputabilite !== 'AU_CHOIX' && motif.commentaireObligatoire && !commentaire?.trim()) {
      throw new BadRequestException({ code: 'COMMENTAIRE', message: `Le motif « ${motif.libelle} » demande un commentaire.` });
    }
    return motif;
  }

  /**
   * Motif « au choix » (refus de la compagnie, opération déjà en cours) : le back-office décide,
   * au cas par cas, si l'annulation est imputable au mandataire, et en donne la raison.
   */
  private exigerChoixSiBesoin(motif: { imputabilite: string; libelle: string }, u: UtilisateurConnecte, choix: boolean | undefined, commentaire?: string) {
    if (motif.imputabilite !== 'AU_CHOIX') return;
    if (!estGestion(u)) {
      throw new ForbiddenException({ code: 'MOTIF_BACK_OFFICE', message: `Le motif « ${motif.libelle} » est retenu par le back-office, qui décide s’il est imputable.` });
    }
    if (choix === undefined) {
      throw new BadRequestException({ code: 'IMPUTABILITE', message: `Pour « ${motif.libelle} », précisez si l’annulation est imputable au mandataire.` });
    }
    if (!commentaire?.trim()) {
      throw new BadRequestException({ code: 'COMMENTAIRE', message: `Pour « ${motif.libelle} », expliquez votre choix en commentaire.` });
    }
  }

  private ponderer(
    motif: { imputabilite: ImputabiliteMotif },
    choix: boolean | undefined,
    tardive: boolean,
    saisieLe: Date,
    maintenant: Date,
    p: { ancienneteAnnulationJours: number; poidsAnnulationAggravee: number },
  ): { imputable: boolean; poids: number } {
    const imputable = imputabiliteRetenue(motif.imputabilite, { tardive, choixBackOffice: choix ?? null });
    const poids = poidsAnnulation({
      imputable,
      tardive,
      ancienneteJours: ancienneteJours(saisieLe, maintenant),
      seuilAncienneteJours: p.ancienneteAnnulationJours,
      poidsAggrave: p.poidsAnnulationAggravee,
    });
    return { imputable, poids };
  }

  private async apporteurCible(apporteurId: string | undefined, u: UtilisateurConnecte): Promise<Apporteur> {
    if (apporteurId) {
      exigerGestion(u);
      const a = await this.referentiels.apporteur(apporteurId);
      if (!a.actif) {
        throw new BadRequestException({ code: 'APPORTEUR', message: 'Cet apporteur est inactif.' });
      }
      return a;
    }
    const moi = await this.referentiels.apporteurDeCompte(u.id);
    if (!moi || !moi.actif) {
      throw new ForbiddenException({ code: 'APPORTEUR', message: 'Votre compte n’est rattaché à aucun apporteur actif : le cabinet doit le faire avant votre première réservation.' });
    }
    return moi;
  }

  private tauxApplicable(e: { tauxCommission: Decimal }, r: { origineClient: string; clientConfie: { taux: Decimal } | null }): Decimal {
    return r.origineClient === 'CONFIE' && r.clientConfie ? r.clientConfie.taux : e.tauxCommission;
  }

  // Contrôles

  private normaliser(dto: EntreeSaisie): Saisie {
    const arbitrage = dto.typeOperation === 'ARBITRAGE';
    const mode = arbitrage ? (dto.modeArbitrage ?? null) : null;
    const numero = dto.numeroContrat ? nettoyerNumeroContrat(dto.numeroContrat) : '';
    return {
      typeOperation: dto.typeOperation,
      typeClient: dto.typeClient,
      clientNom: dto.clientNom.trim(),
      clientPrenom: dto.typeClient === 'PHYSIQUE' ? dto.clientPrenom?.trim() || null : null,
      numeroContrat: numero || null,
      numeroDemande: dto.numeroDemande?.trim() || null,
      montantBrut: dto.montantBrut,
      tauxFrais: dto.tauxFrais,
      clientPrevendu: dto.clientPrevendu,
      encoursClient: dto.encoursClient ?? null,
      codeApporteurId: dto.codeApporteurId ?? null,
      gammeId: dto.gammeId ?? null,
      modeArbitrage: mode,
      pourcentageArbitrage: mode === 'GLOBAL' ? (dto.pourcentageArbitrage ?? null) : null,
      valeurContrat: mode ? (dto.valeurContrat ?? null) : null,
      fonds:
        mode === 'PAR_FONDS'
          ? (dto.fonds ?? []).map((f) => ({
              fondsId: f.fondsId ?? null,
              nom: f.nom.trim(),
              isin: f.isin?.trim().toUpperCase() || null,
              montant: f.pourcentage ? null : (f.montant ?? null),
              pourcentage: f.pourcentage ?? null,
            }))
          : [],
      reservationGlobaleId: dto.reservationGlobaleId ?? null,
    };
  }

  private async preparer(db: Db, e: EnveloppeComplete, apporteur: Apporteur, s: Saisie, exclureId: string | null, maintenant: Date): Promise<Preparation> {
    // Code apporteur : seuls les codes valables de l'apporteur chez la compagnie ; pré-rempli s'il n'y en a qu'un.
    const codes = await this.referentiels.codesValables(apporteur.id, e.compagnieId, maintenant);
    const codeApporteurId = s.codeApporteurId ?? (codes.length === 1 ? codes[0].id : null);

    if (s.gammeId && !e.compagnie.gammes.some((g) => g.id === s.gammeId)) {
      throw new BadRequestException({ code: 'GAMME', message: 'Cette gamme n’appartient pas à la compagnie de l’enveloppe.' });
    }

    const idsFonds = s.fonds.map((f) => f.fondsId).filter((x): x is string => !!x);
    if (idsFonds.length) {
      const connus = await db.fonds.findMany({ where: { id: { in: idsFonds }, compagnieId: e.compagnieId }, select: { id: true } });
      if (connus.length !== new Set(idsFonds).size) {
        throw new BadRequestException({ code: 'FONDS', message: 'Un fonds choisi n’appartient pas à la compagnie de l’enveloppe.' });
      }
    }
    for (const f of s.fonds) {
      if (f.isin && !isinValide(f.isin)) {
        throw new BadRequestException({ code: 'ISIN', message: `Code ISIN invalide pour ${f.nom} (clé de contrôle comprise).` });
      }
      if (!f.montant && !f.pourcentage) {
        throw new BadRequestException({ code: 'FONDS', message: `Indiquez un montant ou un pourcentage pour ${f.nom}.` });
      }
    }
    // Pourcentage de l'encours du contrat : le montant de la ligne en est calculé, arrondi au centime.
    const lignes = s.fonds.map((f) => ({
      ...f,
      montant: f.pourcentage ? (s.valeurContrat ? arrondirAuCentime(d(f.pourcentage).times(d(s.valeurContrat))).toFixed(2) : '0.00') : (f.montant as string),
    }));

    const net = montantNet(s.montantBrut, s.tauxFrais);
    const donnees = await this.repository.donneesCompteurs(e.id, db);
    const autres = donnees.reservations.filter((r) => r.id !== exclureId);
    const compteurs = calculerCompteurs({ ...donnees, reservations: autres });

    let soldeGlobaleRestant: Decimal | null = null;
    if (s.reservationGlobaleId) {
      const g = donnees.globales.find((x) => x.id === s.reservationGlobaleId);
      const fiche = g ? await db.reservationGlobale.findUnique({ where: { id: g.id }, select: { apporteurId: true, statut: true } }) : null;
      if (!g || !fiche || fiche.apporteurId !== apporteur.id || fiche.statut !== 'ACTIVE') {
        throw new BadRequestException({ code: 'GLOBALE', message: 'Cette réservation globale n’est pas disponible pour cet apporteur.' });
      }
      soldeGlobaleRestant = soldeGlobale(g, autres).solde;
    }

    const cle = cleClient(s.clientNom, s.clientPrenom);
    const memeClient = await db.reservation.findMany({
      where: { cleClient: cle, statut: { in: [...STATUTS_ACTIFS] }, enveloppe: { statut: 'OUVERTE' }, id: exclureId ? { not: exclureId } : undefined },
      select: { statut: true, montantNet: true, montantValide: true, source: true, reservationGlobaleId: true },
    });
    const cumulClientAutres = somme(memeClient.map(montantRetenu));

    const statutsDoublon: StatutReservation[] = [...STATUTS_ACTIFS, 'LISTE_ATTENTE'];
    const doublon = await db.reservation.findFirst({
      where: {
        enveloppeId: e.id,
        statut: { in: statutsDoublon },
        id: exclureId ? { not: exclureId } : undefined,
        ...(s.typeOperation === 'AFFAIRE_NOUVELLE' ? { typeOperation: 'AFFAIRE_NOUVELLE', cleClient: cle, apporteurId: apporteur.id } : { numeroContrat: s.numeroContrat ?? '—' }),
      },
      select: { numero: true },
    });

    const controle = controlerReservation({
      maintenant,
      enveloppe: {
        statut: e.statut,
        dateLimiteInterne: depuisDateBase(e.dateLimiteInterne),
        montantMinimum: e.montantMinimum,
        seuilConcentration: e.seuilConcentration,
        gammesExclues: e.gammesExclues.map((g) => g.gamme),
        formatNumeroContrat: e.compagnie.formatNumeroContrat,
        compagnieAGammes: e.compagnie.gammes.length > 0,
      },
      reservation: {
        typeOperation: s.typeOperation,
        numeroContrat: s.numeroContrat,
        montantBrut: s.montantBrut,
        montantNet: net,
        encoursClient: s.encoursClient,
        gammeId: s.gammeId,
        codeApporteurValide: !!codeApporteurId && codes.some((c) => c.id === codeApporteurId),
        modeArbitrage: s.modeArbitrage,
        pourcentageArbitrage: s.pourcentageArbitrage,
        valeurContrat: s.valeurContrat,
        fonds: lignes,
      },
      restante: compteurs.restante,
      soldeGlobale: soldeGlobaleRestant,
      cumulClientAutres,
      doublon,
      seuilEstimationArbitrage: (await this.enveloppes.parametres(db)).seuilEstimationArbitrage,
    });
    return {
      controle,
      net,
      codeApporteurId,
      restante: compteurs.restante,
      fonds: lignes.map((f) => ({ ...f, horsReferentiel: !f.fondsId })),
    };
  }

  /**
   * Décide de la suite des contrôles : un constat bloquant arrête tout ; un constat dérogeable
   * exige une dérogation motivée, accordée par la personne habilitée, jamais par l'apporteur
   * lui-même ; une enveloppe pleine peut renvoyer en liste d'attente.
   */
  private decider(p: Preparation, derogations: DerogationDto[] | undefined, listeAttente: boolean, u: UtilisateurConnecte, apporteurUserId: string | null) {
    const refuses: Constat[] = [];
    const accordees: DerogationDto[] = [];
    let attente = false;
    for (const constat of p.controle.derogeables) {
      const accord = derogations?.find((x) => x.code === constat.code);
      if (accord) {
        const niveau = DEROGATIONS[constat.code];
        if (niveau === 'ADMINISTRATEUR' ? !estAdministrateur(u) : !estGestion(u)) {
          throw new ForbiddenException({
            code: 'DEROGATION',
            message: niveau === 'ADMINISTRATEUR' ? 'Seul un administrateur peut accorder cette dérogation.' : 'Seuls le back-office et les administrateurs accordent une dérogation.',
          });
        }
        interdireSurSaPropreReservation(u, apporteurUserId);
        accordees.push(accord);
      } else if (constat.code === 'DEPASSEMENT' && listeAttente) {
        attente = true;
      } else {
        refuses.push(constat);
      }
    }
    if (p.controle.bloquants.length > 0 || refuses.length > 0) {
      const premier = p.controle.bloquants[0] ?? refuses[0];
      throw new UnprocessableEntityException({
        code: 'CONTROLES',
        message: premier.message,
        bloquants: p.controle.bloquants,
        derogeables: refuses,
        alertes: p.controle.alertes,
      });
    }
    return { accordees, attente };
  }

  private apercuDe(p: Preparation, taux: Decimal) {
    return {
      montantNet: p.net.toFixed(2),
      commissionEstimee: commission(p.net, taux).toFixed(2),
      taux: taux.toString(),
      restanteAvant: p.restante.toFixed(2),
      restanteApres: p.restante.minus(p.controle.priseSurEnveloppe).toFixed(2),
      partEncours: p.controle.partEncours?.toDecimalPlaces(4).toString() ?? null,
      codeApporteurId: p.codeApporteurId,
      bloquants: p.controle.bloquants,
      derogeables: p.controle.derogeables,
      alertes: p.controle.alertes,
    };
  }

  private async confieDe(dto: ReservationDto, apporteur: Apporteur) {
    if (!dto.clientConfieId) {
      return null;
    }
    const confie = await this.repository.prisma.clientConfie.findUnique({ where: { id: dto.clientConfieId } });
    if (!confie || confie.apporteurId !== apporteur.id || confie.enveloppeId !== dto.enveloppeId) {
      throw new BadRequestException({ code: 'CONFIE', message: 'Ce client confié n’est pas le vôtre sur cette enveloppe.' });
    }
    if (confie.statut !== 'CONFIE') {
      throw new ConflictException({ code: 'CONFIE', message: 'L’accord de ce client a déjà été signalé.' });
    }
    return confie;
  }

  /** Réservations globales qu'un apporteur peut prendre comme source : le mandataire ne voit que les siennes. */
  async globalesDisponibles(enveloppeId: string, u: UtilisateurConnecte, apporteurId?: string) {
    if (estGestion(u) && !apporteurId) {
      return [];
    }
    const apporteur = await this.apporteurCible(estGestion(u) ? apporteurId : undefined, u);
    return this.enveloppes.globalesDisponibles(enveloppeId, apporteur.id);
  }

  // Saisie

  /** Contrôles et calculs affichés avant l'envoi : net, enveloppe restante après la demande, commission, alertes. */
  async apercu(dto: ReservationDto, u: UtilisateurConnecte) {
    const apporteur = await this.apporteurCible(dto.apporteurId, u);
    const confie = await this.confieDe(dto, apporteur);
    const e = await this.enveloppes.enveloppe(dto.enveloppeId);
    const s = this.normaliser(confie ? { ...dto, typeClient: confie.typeClient, clientNom: confie.clientNom, clientPrenom: confie.clientPrenom ?? undefined } : dto);
    const p = await this.preparer(this.repository.prisma, e, apporteur, s, null, new Date());
    return this.apercuDe(p, confie ? confie.taux : e.tauxCommission);
  }

  async creer(dto: ReservationDto, u: UtilisateurConnecte) {
    const apporteur = await this.apporteurCible(dto.apporteurId, u);
    const confie = await this.confieDe(dto, apporteur);
    const s = this.normaliser(confie ? { ...dto, typeClient: confie.typeClient, clientNom: confie.clientNom, clientPrenom: confie.clientPrenom ?? undefined } : dto);
    const maintenant = new Date();

    const creee = await this.repository.transaction(async (tx) => {
      await this.repository.verrouiller(tx, dto.enveloppeId);
      const e = await this.enveloppes.enveloppe(dto.enveloppeId, tx);
      const p = await this.preparer(tx, e, apporteur, s, null, maintenant);
      const { accordees, attente } = this.decider(p, dto.derogations, dto.listeAttente ?? false, u, apporteur.compte?.id ?? null);
      const statut: StatutReservation = attente ? 'LISTE_ATTENTE' : 'SOUMISE';
      const r = await tx.reservation.create({
        data: {
          enveloppeId: e.id,
          apporteurId: apporteur.id,
          entiteId: apporteur.entite?.id ?? null,
          codeApporteurId: p.codeApporteurId,
          gammeId: s.gammeId,
          typeOperation: s.typeOperation,
          typeClient: s.typeClient,
          clientNom: s.clientNom,
          clientPrenom: s.clientPrenom,
          cleClient: cleClient(s.clientNom, s.clientPrenom),
          numeroContrat: s.numeroContrat,
          numeroDemande: s.numeroDemande,
          montantBrut: s.montantBrut,
          tauxFrais: s.tauxFrais,
          montantNet: p.net,
          clientPrevendu: confie ? true : s.clientPrevendu,
          encoursClient: s.encoursClient,
          origineClient: confie ? 'CONFIE' : 'MANDATAIRE',
          clientConfieId: confie?.id ?? null,
          source: s.reservationGlobaleId ? 'RESERVATION_GLOBALE' : 'ENVELOPPE',
          reservationGlobaleId: s.reservationGlobaleId,
          statut,
          tauxCommission: confie ? confie.taux : e.tauxCommission,
          accordAdministrateur: apporteur.restreint,
          modeArbitrage: s.modeArbitrage,
          pourcentageArbitrage: s.pourcentageArbitrage,
          valeurContrat: s.valeurContrat,
          // Client confié : l'accord du client est l'acte même qui crée la réservation.
          accordClientLe: confie ? maintenant : null,
          avenantVersion: confie ? 1 : 0,
          signalements: p.controle.alertes.map((a) => a.code),
          derogations: accordees.map((x) => x.code),
          creeParId: u.id,
          fonds: { create: p.fonds },
        },
      });
      await this.repository.ecrireHistorique(tx, {
        reservationId: r.id,
        action: confie ? 'ACCORD_CLIENT_CONFIE' : 'CREATION',
        auteurId: u.id,
        auteur: nomComplet(u),
        versStatut: statut,
        details: {
          montantBrut: s.montantBrut,
          tauxFrais: s.tauxFrais,
          montantNet: p.net.toFixed(2),
          alertes: p.controle.alertes.map((a) => a.message),
          pourLeCompteDe: dto.apporteurId ? nomComplet(apporteur) : null,
        },
      });
      for (const x of accordees) {
        await this.repository.ecrireHistorique(tx, { reservationId: r.id, action: 'DEROGATION', auteurId: u.id, auteur: nomComplet(u), commentaire: x.motif, details: { code: x.code } });
      }
      if (confie) {
        await tx.clientConfie.update({ where: { id: confie.id }, data: { statut: 'ACCEPTE' } });
      }
      return r;
    });

    const r = await this.reservation(creee.id);
    await this.tracer(u, 'RESERVATION_CREEE', `Réservation n° ${r.numero} saisie sur ${r.enveloppe.nomProduit}.`, r.id, {
      apporteurId: apporteur.id,
      statut: r.statut,
      derogations: r.derogations,
    });
    for (const code of r.derogations) {
      await this.tracer(u, 'DEROGATION', `Dérogation ${code} sur la réservation n° ${r.numero}.`, r.id);
    }
    await this.notifications.reservationSoumise(r);
    if (confie) {
      await this.notifications.auBackOffice(`client confié · signature à organiser · ${r.enveloppe.nomProduit}`, [
        `Le client confié de la réservation ${this.notifications.designation(r)} a accepté.`,
        'L’avenant est à préparer et à faire signer : signature électronique de la compagnie, ou papier à préciser sur la plateforme.',
        this.notifications.lienReservation(r),
      ]);
    }
    await this.enveloppes.verifierSeuils(r.enveloppeId);
    return this.detail(r.id, u);
  }

  /** Modification : hausse = nouvelle validation ; baisse = annulation partielle motivée ; tout est tracé (annule et remplace). */
  async modifier(id: string, dto: ModificationReservationDto, u: UtilisateurConnecte) {
    const avant = await this.modifiable(id, u);
    this.exigerStatut(avant, STATUTS_MODIFIABLES, 'modifier');
    const maintenant = new Date();
    const actuelle: Saisie = {
      typeOperation: avant.typeOperation,
      typeClient: avant.typeClient,
      clientNom: avant.clientNom,
      clientPrenom: avant.clientPrenom,
      numeroContrat: avant.numeroContrat,
      numeroDemande: avant.numeroDemande,
      montantBrut: avant.montantBrut.toFixed(2),
      tauxFrais: avant.tauxFrais.toString(),
      clientPrevendu: avant.clientPrevendu,
      encoursClient: avant.encoursClient?.toFixed(2) ?? null,
      codeApporteurId: avant.codeApporteurId,
      gammeId: avant.gammeId,
      modeArbitrage: avant.modeArbitrage,
      pourcentageArbitrage: avant.pourcentageArbitrage?.toString() ?? null,
      valeurContrat: avant.valeurContrat?.toFixed(2) ?? null,
      fonds: avant.fonds.map((f) => ({ fondsId: f.fondsId, nom: f.nom, isin: f.isin, montant: f.pourcentage ? null : f.montant.toFixed(2), pourcentage: f.pourcentage?.toString() ?? null })),
      reservationGlobaleId: avant.reservationGlobaleId,
    };
    const garder = <T>(nouveau: T | undefined, ancien: T): T => (nouveau !== undefined ? nouveau : ancien);
    const fusion = this.normaliser({
      typeOperation: actuelle.typeOperation,
      typeClient: garder(dto.typeClient, actuelle.typeClient),
      clientNom: garder(dto.clientNom, actuelle.clientNom),
      clientPrenom: garder(dto.clientPrenom, actuelle.clientPrenom),
      numeroContrat: garder(dto.numeroContrat, actuelle.numeroContrat),
      numeroDemande: garder(dto.numeroDemande, actuelle.numeroDemande),
      montantBrut: garder(dto.montantBrut, actuelle.montantBrut),
      tauxFrais: garder(dto.tauxFrais, actuelle.tauxFrais),
      clientPrevendu: garder(dto.clientPrevendu, actuelle.clientPrevendu),
      encoursClient: garder(dto.encoursClient, actuelle.encoursClient),
      codeApporteurId: garder(dto.codeApporteurId, actuelle.codeApporteurId),
      gammeId: garder(dto.gammeId, actuelle.gammeId),
      modeArbitrage: garder(dto.modeArbitrage, actuelle.modeArbitrage),
      pourcentageArbitrage: garder(dto.pourcentageArbitrage, actuelle.pourcentageArbitrage),
      valeurContrat: garder(dto.valeurContrat, actuelle.valeurContrat),
      fonds: dto.fonds ? dto.fonds.map((f) => ({ fondsId: f.fondsId ?? null, nom: f.nom, isin: f.isin ?? null, montant: f.montant ?? null, pourcentage: f.pourcentage ?? null })) : actuelle.fonds,
      reservationGlobaleId: actuelle.reservationGlobaleId,
    });

    const nouveauNet = montantNet(fusion.montantBrut, fusion.tauxFrais);
    const hausse = nouveauNet.greaterThan(avant.montantNet);
    const baisse = nouveauNet.lessThan(avant.montantNet);
    let motifBaisse: Awaited<ReturnType<ReservationsService['motifValable']>> | null = null;
    if (baisse && avant.statut !== 'LISTE_ATTENTE') {
      if (!dto.motifBaisseId) {
        throw new BadRequestException({ code: 'MOTIF', message: 'Une baisse de montant est une annulation partielle : indiquez son motif.' });
      }
      motifBaisse = await this.motifValable(dto.motifBaisseId, 'ANNULATION', dto.commentaire);
      this.exigerChoixSiBesoin(motifBaisse, u, dto.imputable, dto.commentaire);
    }
    const apporteur = await this.referentiels.apporteur(avant.apporteurId);
    const parametres = await this.enveloppes.parametres();

    await this.repository.transaction(async (tx) => {
      await this.repository.verrouiller(tx, avant.enveloppeId);
      const e = await this.enveloppes.enveloppe(avant.enveloppeId, tx);
      const p = await this.preparer(tx, e, apporteur, fusion, avant.id, maintenant);
      // Une modification n'est pas une nouvelle saisie : sans hausse, ni le dépassement ni la date
      // limite ne s'appliquent ; une dérogation déjà accordée vaut tant que son objet ne change pas.
      p.controle.derogeables = p.controle.derogeables.filter((constat) => {
        if (!hausse && (constat.code === 'DEPASSEMENT' || constat.code === 'DATE_LIMITE')) return false;
        if (constat.code === 'FORMAT_CONTRAT' && avant.derogations.includes('FORMAT_CONTRAT') && fusion.numeroContrat === actuelle.numeroContrat) return false;
        return true;
      });
      // En liste d'attente, la demande reste en attente : seul le dépassement y est admis.
      const { accordees } = this.decider(p, dto.derogations, avant.statut === 'LISTE_ATTENTE', u, avant.apporteur.userId);
      let statut = avant.statut;
      if (avant.statut === 'RENVOYEE' || (hausse && ['VALIDEE', 'ECHUE'].includes(avant.statut))) {
        statut = 'SOUMISE';
      }
      const changeAvenant = !!avant.accordClientLe && CHAMPS_AVENANT.some((c) => JSON.stringify(fusion[c]) !== JSON.stringify(actuelle[c]));
      await tx.ligneFonds.deleteMany({ where: { reservationId: avant.id } });
      await tx.reservation.update({
        where: { id: avant.id },
        data: {
          typeClient: fusion.typeClient,
          clientNom: fusion.clientNom,
          clientPrenom: fusion.clientPrenom,
          cleClient: cleClient(fusion.clientNom, fusion.clientPrenom),
          numeroContrat: fusion.numeroContrat,
          numeroDemande: fusion.numeroDemande,
          montantBrut: fusion.montantBrut,
          tauxFrais: fusion.tauxFrais,
          montantNet: p.net,
          clientPrevendu: fusion.clientPrevendu,
          encoursClient: fusion.encoursClient,
          codeApporteurId: p.codeApporteurId,
          gammeId: fusion.gammeId,
          modeArbitrage: fusion.modeArbitrage,
          pourcentageArbitrage: fusion.pourcentageArbitrage,
          valeurContrat: fusion.valeurContrat,
          statut,
          // Une hausse repasse en validation : le taux sera figé de nouveau à la validation.
          tauxFigeLe: statut === 'SOUMISE' && avant.statut !== 'SOUMISE' ? null : undefined,
          signalements: p.controle.alertes.map((a) => a.code),
          derogations: [...new Set([...avant.derogations, ...accordees.map((x) => x.code)])],
          avenantVersion: changeAvenant ? avant.avenantVersion + 1 : undefined,
          relancesEnvoyees: avant.statut === 'RENVOYEE' ? 0 : undefined,
          fonds: { create: p.fonds },
        },
      });
      const tardive = estTardive(depuisDateBase(e.dateLimiteInterne), maintenant, parametres.delaiAnnulationTardiveJours);
      const ponderation = motifBaisse ? this.ponderer(motifBaisse, dto.imputable, tardive, avant.createdAt, maintenant, parametres) : null;
      await this.historique(tx, avant, u, baisse ? 'BAISSE' : 'MODIFICATION', statut !== avant.statut ? statut : null, dto.commentaire ?? null, {
        avant: { montantBrut: actuelle.montantBrut, tauxFrais: actuelle.tauxFrais, montantNet: avant.montantNet.toFixed(2), numeroContrat: actuelle.numeroContrat, clientNom: actuelle.clientNom, fonds: actuelle.fonds },
        apres: { montantBrut: fusion.montantBrut, tauxFrais: fusion.tauxFrais, montantNet: p.net.toFixed(2), numeroContrat: fusion.numeroContrat, clientNom: fusion.clientNom, fonds: fusion.fonds },
        ...(motifBaisse
          ? { montantRetire: avant.montantNet.minus(p.net).toFixed(2), tardive, imputable: ponderation!.imputable, poids: ponderation!.poids, motif: motifBaisse.libelle }
          : {}),
        ...(changeAvenant ? { avenant: `Avenant version ${avant.avenantVersion} périmé ; version ${avant.avenantVersion + 1} produite.` } : {}),
      });
      for (const x of accordees) {
        await this.repository.ecrireHistorique(tx, { reservationId: avant.id, action: 'DEROGATION', auteurId: u.id, auteur: nomComplet(u), commentaire: x.motif, details: { code: x.code } });
      }
    });
    await this.tracer(u, 'RESERVATION_MODIFIEE', `Réservation n° ${avant.numero} modifiée.`, avant.id, { hausse, baisse });
    if (baisse) {
      await this.enveloppes.signalerMontantLibere(avant.enveloppeId, 'une baisse de montant');
    }
    await this.enveloppes.verifierSeuils(avant.enveloppeId);
    return this.detail(avant.id, u);
  }

  // Décisions du back-office

  async valider(id: string, u: UtilisateurConnecte) {
    exigerGestion(u);
    const r = await this.reservation(id);
    // Décision du 18 novembre : un super administrateur peut valider sa propre réservation ;
    // c'est tracé et les autres super administrateurs en sont prévenus.
    const saPropre = this.estApporteur(r, u) && estSuperAdministrateur(u);
    if (!saPropre) {
      interdireSurSaPropreReservation(u, r.apporteur.userId);
    }
    this.exigerStatut(r, ['SOUMISE'], 'valider');
    if (r.accordAdministrateur && !estAdministrateur(u)) {
      throw new ForbiddenException({ code: 'RESTREINT', message: 'Cet apporteur est restreint : sa réservation est soumise à l’accord d’un administrateur.' });
    }
    const e = await this.enveloppes.enveloppe(r.enveloppeId);
    const parametres = await this.enveloppes.parametres();
    const maintenant = new Date();
    const echeance = calculerEcheance(dateParis(maintenant), parametres.delaiHonorerJours, depuisDateBase(e.dateLimiteInterne));
    const taux = this.tauxApplicable(e, r);
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: { statut: 'VALIDEE', valideeLe: maintenant, tauxCommission: taux, tauxFigeLe: maintenant, echeance: versDateBase(echeance), rappelEcheanceEnvoye: false },
      });
      await this.historique(tx, r, u, 'VALIDATION', 'VALIDEE', null, { echeance, taux: taux.toString() });
    });
    await this.tracer(u, 'RESERVATION_VALIDEE', `Réservation n° ${r.numero} validée${saPropre ? ' par son propre apporteur, super administrateur' : ''}.`, id, {
      apporteurId: r.apporteurId,
      saPropreReservation: saPropre,
    });
    if (saPropre) {
      const autres = await this.repository.prisma.user.findMany({
        where: { profil: 'SUPER_ADMINISTRATEUR', actif: true, id: { not: u.id }, motDePasse: { not: null } },
        select: { email: true },
      });
      await this.notifications.envoyer(autres.map((a) => a.email), `validation de sa propre réservation · ${r.enveloppe.nomProduit}`, [
        `${nomComplet(u)} a validé sa propre réservation : ${this.notifications.designation(r)}.`,
        'L’action est inscrite au journal.',
        this.notifications.lienReservation(r),
      ]);
    }
    await this.notifications.decision(r, `réservation validée · ${r.enveloppe.nomProduit}`, [
      'Votre réservation est validée.',
      `Elle doit être honorée au plus tard le ${this.notifications.dateLisible(echeance)}.`,
      r.typeOperation === 'ARBITRAGE' && !r.accordClientLe ? 'Quand le client accepte l’arbitrage, déclarez-le : l’avenant pré-rempli sera alors disponible.' : '',
    ].filter(Boolean));
    return this.detail(id, u);
  }

  async refuser(id: string, dto: DecisionDto, u: UtilisateurConnecte) {
    const r = await this.decidable(id, u);
    this.exigerStatut(r, ['SOUMISE', 'RENVOYEE', 'LISTE_ATTENTE'], 'refuser');
    const motif = await this.motifValable(dto.motifId, 'REFUS', dto.commentaire);
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { statut: 'REFUSEE', motifId: motif.id, commentaireMotif: dto.commentaire?.trim() || null } });
      await this.historique(tx, r, u, 'REFUS', 'REFUSEE', dto.commentaire, { motif: motif.libelle });
    });
    await this.tracer(u, 'RESERVATION_REFUSEE', `Réservation n° ${r.numero} refusée.`, id, { motif: motif.libelle });
    await this.notifications.decision(r, `réservation refusée · ${r.enveloppe.nomProduit}`, [`Votre réservation est refusée. Motif : ${motif.libelle}.`, dto.commentaire ? `Précision : ${dto.commentaire}` : ''].filter(Boolean));
    if (r.statut !== 'LISTE_ATTENTE') {
      await this.enveloppes.signalerMontantLibere(r.enveloppeId, 'un refus');
    }
    return this.detail(id, u);
  }

  async renvoyer(id: string, dto: DecisionDto, u: UtilisateurConnecte) {
    const r = await this.decidable(id, u);
    this.exigerStatut(r, ['SOUMISE'], 'renvoyer');
    const motif = await this.motifValable(dto.motifId, 'RENVOI', dto.commentaire);
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { statut: 'RENVOYEE', motifId: motif.id, commentaireMotif: dto.commentaire?.trim() || null, relancesEnvoyees: 0, derniereRelanceLe: new Date() } });
      await this.historique(tx, r, u, 'RENVOI', 'RENVOYEE', dto.commentaire, { motif: motif.libelle });
    });
    await this.tracer(u, 'RESERVATION_RENVOYEE', `Réservation n° ${r.numero} renvoyée au mandataire.`, id, { motif: motif.libelle });
    await this.notifications.decision(r, `réservation à corriger · ${r.enveloppe.nomProduit}`, [
      `Votre réservation vous est renvoyée. Action attendue : ${motif.libelle}.`,
      dto.commentaire ? `Précision : ${dto.commentaire}` : '',
      `Date limite interne : ${this.notifications.dateLisible(r.enveloppe.dateLimiteInterne)}.`,
    ].filter(Boolean));
    return this.detail(id, u);
  }

  /** Annulation avant l'opération, par l'apporteur ou le back-office, avec motif. */
  async annuler(id: string, dto: AnnulationDto, u: UtilisateurConnecte) {
    const r = await this.modifiable(id, u);
    this.exigerStatut(r, STATUTS_AVANT_OPERATION, 'annuler');
    const motif = await this.motifValable(dto.motifId, 'ANNULATION', dto.commentaire);
    const parametres = await this.enveloppes.parametres();
    const maintenant = new Date();
    const tardive = estTardive(depuisDateBase(r.enveloppe.dateLimiteInterne), maintenant, parametres.delaiAnnulationTardiveJours);
    this.exigerChoixSiBesoin(motif, u, dto.imputable, dto.commentaire);
    const { imputable, poids } = this.ponderer(motif, dto.imputable, tardive, r.createdAt, maintenant, parametres);
    if (tardive && imputable && !estGestion(u) && !dto.confirmeTardive) {
      throw new ConflictException({
        code: 'TARDIVE',
        message: `Nous sommes à moins de ${parametres.delaiAnnulationTardiveJours} jours de la date limite interne : cette annulation sera comptée comme tardive. Confirmez-vous ?`,
      });
    }
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: {
          statut: 'ANNULEE',
          annuleeLe: maintenant,
          annulationTardive: tardive,
          annulationImputable: imputable,
          poidsAnnulation: poids,
          motifId: motif.id,
          commentaireMotif: dto.commentaire?.trim() || null,
        },
      });
      await this.historique(tx, r, u, 'ANNULATION', 'ANNULEE', dto.commentaire, { motif: motif.libelle, imputable, tardive, poids });
    });
    await this.tracer(u, 'RESERVATION_ANNULEE', `Réservation n° ${r.numero} annulée${tardive ? ' (tardive)' : ''}.`, id, { motif: motif.libelle });
    if (!this.estApporteur(r, u)) {
      await this.notifications.decision(r, `réservation annulée · ${r.enveloppe.nomProduit}`, [`Votre réservation est annulée par le cabinet. Motif : ${motif.libelle}.`]);
    }
    if (r.statut !== 'LISTE_ATTENTE') {
      await this.enveloppes.signalerMontantLibere(r.enveloppeId, 'une annulation');
    }
    return this.detail(id, u);
  }

  // Avenant, patrimoine, opération

  /**
   * Le commercial déclare que le client a accepté l'arbitrage : l'avenant pré-rempli est alors
   * produit et mis en téléchargement. Rien n'est produit avant.
   */
  async accordClient(id: string, u: UtilisateurConnecte) {
    const r = await this.modifiable(id, u);
    if (r.typeOperation !== 'ARBITRAGE') {
      throw new UnprocessableEntityException({
        code: 'A_CONFIRMER',
        message: 'Pour un versement libre ou une affaire nouvelle, la production d’un document pré-rempli est en attente d’une décision du cabinet.',
      });
    }
    this.exigerStatut(r, ['SOUMISE', 'VALIDEE', 'ECHUE'], 'déclarer l’accord du client sur');
    if (r.accordClientLe) {
      throw new ConflictException({ code: 'DEJA', message: 'L’accord du client est déjà déclaré.' });
    }
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { accordClientLe: new Date(), avenantVersion: 1 } });
      await this.historique(tx, r, u, 'ACCORD_CLIENT', null, null, { avenantVersion: 1 });
    });
    await this.tracer(u, 'ACCORD_CLIENT', `Accord du client déclaré sur la réservation n° ${r.numero}.`, id);
    return this.detail(id, u);
  }

  /** Fiche des valeurs à reporter sur l'avenant : seulement après la déclaration de l'accord du client. */
  async ficheAvenant(id: string, u: UtilisateurConnecte): Promise<{ nom: string; contenu: Uint8Array }> {
    const r = await this.lisible(id, u);
    if (!r.accordClientLe) {
      throw new BadRequestException({ code: 'ACCORD', message: 'L’avenant est produit seulement quand l’accord du client est déclaré.' });
    }
    if (['REFUSEE', 'ANNULEE', 'ANNULEE_APRES_OPERATION', 'LIBEREE'].includes(r.statut)) {
      throw new BadRequestException({ code: 'STATUT', message: 'Cette réservation est close : aucun avenant n’est produit.' });
    }
    const contenu = await ficheAvenantPdf({
      compagnie: r.enveloppe.compagnie.nom,
      produit: r.enveloppe.nomProduit,
      isinProduit: r.enveloppe.isin,
      typeClient: r.typeClient,
      clientNom: r.clientNom,
      clientPrenom: r.clientPrenom,
      numeroContrat: r.numeroContrat,
      montantNet: r.montantNet.toFixed(2),
      modeArbitrage: r.modeArbitrage,
      pourcentageArbitrage: r.pourcentageArbitrage?.toString() ?? null,
      fonds: r.fonds.map((f) => ({ nom: f.nom, isin: f.isin, montant: f.montant.toFixed(2), pourcentage: f.pourcentage?.toString() ?? null })),
      apporteur: `${r.apporteur.prenom} ${r.apporteur.nom}`,
      codeApporteur: r.codeApporteur?.code ?? null,
      date: dateParis(new Date()),
      version: r.avenantVersion,
      numeroReservation: r.numero,
    });
    await this.tracer(u, 'FICHE_AVENANT_PRODUITE', `Fiche avenant, version ${r.avenantVersion}, de la réservation n° ${r.numero} téléchargée.`, id, {
      version: r.avenantVersion,
      empreinte: createHash('sha256').update(contenu).digest('hex'),
    });
    return { nom: `avenant-reservation-${r.numero}-v${r.avenantVersion}.pdf`, contenu };
  }

  /** Produits Swiss Life : case « situation patrimoniale à jour » et sa date. */
  async patrimoine(id: string, dto: PatrimoineDto, u: UtilisateurConnecte) {
    const r = await this.modifiable(id, u);
    if (!r.enveloppe.controlePatrimoine) {
      throw new BadRequestException({ code: 'SANS_OBJET', message: 'Ce contrôle ne concerne pas cette enveloppe.' });
    }
    this.exigerStatut(r, [...STATUTS_AVANT_OPERATION], 'renseigner le patrimoine de');
    const date = dto.aJour ? (dto.date ?? dateParis(new Date())) : null;
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { patrimoineAJour: dto.aJour, datePatrimoine: date ? versDateBase(date) : null } });
      await this.historique(tx, r, u, 'PATRIMOINE', null, null, { aJour: dto.aJour, date });
    });
    return this.detail(id, u);
  }

  private exigerPatrimoine(r: ReservationComplete) {
    if (r.enveloppe.controlePatrimoine && !r.patrimoineAJour) {
      throw new UnprocessableEntityException({
        code: 'PATRIMOINE',
        message: 'La situation patrimoniale du client doit être à jour avant de déclarer l’opération (contrôle Swiss Life).',
      });
    }
  }

  /** L'opération est passée : les relances s'arrêtent et la ligne entre dans la file de vérification. */
  async declarerOperation(id: string, dto: DeclarationOperationDto, u: UtilisateurConnecte) {
    const r = await this.modifiable(id, u);
    this.exigerStatut(r, ['VALIDEE', 'ECHUE'], 'déclarer l’opération de');
    this.exigerPatrimoine(r);
    if (dto.dateOperation > dateParis(new Date())) {
      throw new BadRequestException({ code: 'DATE', message: 'La date de l’opération ne peut pas être dans le futur.' });
    }
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: { statut: 'OPERATION_PASSEE', dateOperation: versDateBase(dto.dateOperation), modeOperation: dto.modeOperation, operationDeclareeLe: new Date() },
      });
      await this.historique(tx, r, u, 'OPERATION_DECLAREE', 'OPERATION_PASSEE', null, { dateOperation: dto.dateOperation, mode: dto.modeOperation });
    });
    await this.tracer(u, 'OPERATION_DECLAREE', `Opération déclarée sur la réservation n° ${r.numero}.`, id);
    if (r.origineClient === 'CONFIE' && !this.estApporteur(r, u)) {
      await this.notifications.decision(r, `client confié · signature reçue · ${r.enveloppe.nomProduit}`, [
        `La signature du client est reçue (${dto.modeOperation === 'PAPIER' ? 'sur papier' : 'signature électronique'}). Le montant validé par la compagnie suivra.`,
      ]);
    }
    return this.detail(id, u);
  }

  /** Vérification compagnie : montant validé, dates, mode ; au-delà du seuil, l'écart exige un motif. */
  async verifier(id: string, dto: VerificationDto, u: UtilisateurConnecte) {
    const r = await this.decidable(id, u);
    this.exigerStatut(r, ['VALIDEE', 'ECHUE', 'OPERATION_PASSEE'], 'vérifier');
    const declaree = r.statut === 'OPERATION_PASSEE';
    if (!declaree) {
      if (!dto.dateOperation || !dto.modeOperation) {
        throw new BadRequestException({ code: 'OPERATION', message: 'L’opération n’est pas déclarée : indiquez sa date et son mode.' });
      }
      this.exigerPatrimoine(r);
    }
    const parametres = await this.enveloppes.parametres();
    const valide = d(dto.montantValide);
    const ecart = valide.minus(r.montantNet);
    const ratio = part(ecart.abs(), r.montantNet);
    const anomalie = ratio.greaterThan(parametres.seuilEcart);
    const motif = dto.motifEcartId ? await this.motifValable(dto.motifEcartId, 'ECART', dto.commentaire) : null;
    const statut: StatutReservation = anomalie && !motif ? 'ECART_A_JUSTIFIER' : 'VERIFIEE';
    await this.repository.transaction(async (tx) => {
      await this.repository.verrouiller(tx, r.enveloppeId);
      await tx.reservation.update({
        where: { id },
        data: {
          statut,
          montantValide: valide,
          dateValidationCompagnie: versDateBase(dto.dateValidationCompagnie),
          verifieeLe: new Date(),
          dateOperation: declaree ? undefined : versDateBase(dto.dateOperation!),
          modeOperation: declaree ? (dto.modeOperation ?? undefined) : dto.modeOperation,
          operationDeclareeLe: declaree ? undefined : new Date(),
          motifEcartId: anomalie && motif ? motif.id : null,
          commentaireEcart: anomalie && motif ? dto.commentaire?.trim() || null : null,
        },
      });
      await this.historique(tx, r, u, 'VERIFICATION', statut, dto.commentaire, {
        montantValide: valide.toFixed(2),
        ecart: ecart.toFixed(2),
        ecartPct: ratio.times(100).toDecimalPlaces(2).toString(),
        motifEcart: motif?.libelle ?? null,
      });
    });
    await this.tracer(u, 'RESERVATION_VERIFIEE', `Vérification compagnie de la réservation n° ${r.numero}.`, id, { statut, montantValide: valide.toFixed(2) });
    if (r.reservationGlobaleId && r.reservationGlobale) {
      const donnees = await this.repository.donneesCompteurs(r.enveloppeId);
      const { consomme } = soldeGlobale(r.reservationGlobale, donnees.reservations);
      const disponible = d(r.reservationGlobale.montant).minus(r.reservationGlobale.montantLibere);
      if (consomme.greaterThan(disponible)) {
        await this.notifications.auBackOffice(`réservation globale dépassée · ${r.enveloppe.nomProduit}`, [
          `Le montant validé de la réservation ${this.notifications.designation(r)} dépasse le solde de sa réservation globale.`,
          `L’excédent (${this.notifications.euros(consomme.minus(disponible))}) est imputé à l’enveloppe globale.`,
        ]);
      }
    }
    if (r.origineClient === 'CONFIE') {
      await this.notifications.decision(r, `client confié · montant validé · ${r.enveloppe.nomProduit}`, [
        `La compagnie a validé ${this.notifications.euros(valide)}. La commission est calculée au taux des clients confiés.`,
      ]);
    }
    await this.enveloppes.verifierSeuils(r.enveloppeId);
    return this.detail(id, u);
  }

  async justifierEcart(id: string, dto: JustificationEcartDto, u: UtilisateurConnecte) {
    const r = await this.decidable(id, u);
    this.exigerStatut(r, ['ECART_A_JUSTIFIER'], 'justifier l’écart de');
    const motif = await this.motifValable(dto.motifEcartId, 'ECART', dto.commentaire);
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { statut: 'VERIFIEE', motifEcartId: motif.id, commentaireEcart: dto.commentaire?.trim() || null } });
      await this.historique(tx, r, u, 'ECART_JUSTIFIE', 'VERIFIEE', dto.commentaire, { motif: motif.libelle });
    });
    await this.tracer(u, 'ECART_JUSTIFIE', `Écart de la réservation n° ${r.numero} justifié.`, id, { motif: motif.libelle });
    return this.detail(id, u);
  }

  // Réservations échues

  /** Après contact du mandataire et compte rendu : prolongation avec nouvelle échéance. */
  async prolonger(id: string, dto: TraitementEcheanceDto, u: UtilisateurConnecte) {
    const r = await this.decidable(id, u);
    this.exigerStatut(r, ['ECHUE'], 'prolonger');
    const limite = depuisDateBase(r.enveloppe.dateLimiteInterne);
    if (!dto.echeance || dto.echeance > limite || estDepassee(dto.echeance, new Date())) {
      throw new BadRequestException({ code: 'ECHEANCE', message: 'La nouvelle échéance doit être à venir et ne pas dépasser la date limite interne.' });
    }
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { statut: 'VALIDEE', echeance: versDateBase(dto.echeance!), rappelEcheanceEnvoye: false } });
      await this.historique(tx, r, u, 'PROLONGATION', 'VALIDEE', dto.compteRendu, { echeance: dto.echeance });
    });
    await this.tracer(u, 'RESERVATION_PROLONGEE', `Réservation n° ${r.numero} prolongée.`, id, { echeance: dto.echeance });
    await this.notifications.decision(r, `réservation prolongée · ${r.enveloppe.nomProduit}`, [`Votre réservation est prolongée jusqu’au ${this.notifications.dateLisible(dto.echeance)}.`]);
    return this.detail(id, u);
  }

  /** Après contact du mandataire et compte rendu : libération, comptée « non honorée ». */
  async liberer(id: string, dto: TraitementEcheanceDto, u: UtilisateurConnecte) {
    const r = await this.decidable(id, u);
    this.exigerStatut(r, ['ECHUE'], 'libérer');
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { statut: 'LIBEREE' } });
      await this.historique(tx, r, u, 'LIBERATION', 'LIBEREE', dto.compteRendu);
    });
    await this.tracer(u, 'RESERVATION_LIBEREE', `Réservation n° ${r.numero} libérée.`, id);
    await this.notifications.decision(r, `réservation libérée · ${r.enveloppe.nomProduit}`, ['Votre réservation échue est libérée : le montant est rendu à l’enveloppe.']);
    await this.enveloppes.signalerMontantLibere(r.enveloppeId, 'une libération');
    return this.detail(id, u);
  }

  /**
   * Après l'opération, seul le back-office annule : arbitrage refusé par la compagnie, renonciation,
   * paiement rejeté. Les deux compteurs sont rétablis.
   */
  async annulerApresOperation(id: string, dto: DecisionDto, u: UtilisateurConnecte) {
    const r = await this.decidable(id, u);
    this.exigerStatut(r, STATUTS_APRES_OPERATION, 'annuler après opération');
    const motif = await this.motifValable(dto.motifId, 'ANNULATION', dto.commentaire);
    const parametres = await this.enveloppes.parametres();
    const maintenant = new Date();
    const tardive = estTardive(depuisDateBase(r.enveloppe.dateLimiteInterne), maintenant, parametres.delaiAnnulationTardiveJours);
    this.exigerChoixSiBesoin(motif, u, dto.imputable, dto.commentaire);
    const { imputable, poids } = this.ponderer(motif, dto.imputable, tardive, r.createdAt, maintenant, parametres);
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: {
          statut: 'ANNULEE_APRES_OPERATION',
          annuleeLe: maintenant,
          annulationTardive: tardive,
          annulationImputable: imputable,
          poidsAnnulation: poids,
          motifId: motif.id,
          commentaireMotif: dto.commentaire?.trim() || null,
        },
      });
      await this.historique(tx, r, u, 'ANNULATION_APRES_OPERATION', 'ANNULEE_APRES_OPERATION', dto.commentaire, { motif: motif.libelle, imputable, tardive, poids });
    });
    await this.tracer(u, 'RESERVATION_ANNULEE_APRES_OPERATION', `Réservation n° ${r.numero} annulée après opération.`, id, { motif: motif.libelle });
    await this.notifications.decision(r, `opération annulée · ${r.enveloppe.nomProduit}`, [`L’opération est annulée. Motif : ${motif.libelle}. Aucune commission n’est due sur cette ligne.`]);
    await this.enveloppes.signalerMontantLibere(r.enveloppeId, 'une annulation après opération');
    return this.detail(id, u);
  }

  // Liste d'attente

  async listeAttente(enveloppeId: string, u: UtilisateurConnecte) {
    exigerGestion(u);
    const liste = await this.repository.listerReservations({ enveloppeId, statut: 'LISTE_ATTENTE' });
    return liste.map((r, i) => ({ rang: i + 1, ...this.ligne(r, u) }));
  }

  /**
   * Le back-office ou l'administrateur sert une demande de la liste d'attente. Un choix hors de
   * l'ordre d'arrivée est tracé ; un service partiel demande l'accord du mandataire.
   */
  async servir(id: string, dto: ServiceAttenteDto, u: UtilisateurConnecte) {
    const r = await this.decidable(id, u);
    this.exigerStatut(r, ['LISTE_ATTENTE'], 'servir');
    const premier = await this.repository.prisma.reservation.findFirst({ where: { enveloppeId: r.enveloppeId, statut: 'LISTE_ATTENTE' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    const horsOrdre = premier?.id !== r.id;
    if (horsOrdre && !dto.motifHorsOrdre?.trim()) {
      throw new BadRequestException({ code: 'ORDRE', message: 'Cette demande n’est pas la première arrivée : indiquez pourquoi vous la servez avant.' });
    }
    let brut = r.montantBrut.toFixed(2);
    if (dto.montantBrut && d(dto.montantBrut).lessThan(r.montantBrut)) {
      if (!dto.accordMandataire) {
        throw new BadRequestException({ code: 'ACCORD', message: 'Un service partiel demande l’accord du mandataire.' });
      }
      brut = dto.montantBrut;
    }
    const net = montantNet(brut, r.tauxFrais);
    await this.repository.transaction(async (tx) => {
      await this.repository.verrouiller(tx, r.enveloppeId);
      const donnees = await this.repository.donneesCompteurs(r.enveloppeId, tx);
      const c = calculerCompteurs({ ...donnees, reservations: donnees.reservations.filter((x) => x.id !== r.id) });
      const derogation = net.greaterThan(c.restante);
      if (derogation && !dto.motifDerogation?.trim()) {
        throw new UnprocessableEntityException({ code: 'DEPASSEMENT', message: `Le montant dépasse l’enveloppe restante (${this.notifications.euros(Decimal.max(c.restante, ZERO))}) : servez en partie, ou motivez une dérogation.` });
      }
      await tx.reservation.update({
        where: { id },
        data: { statut: 'SOUMISE', montantBrut: brut, montantNet: net, derogations: derogation ? [...new Set([...r.derogations, 'DEPASSEMENT'])] : undefined },
      });
      await this.historique(tx, r, u, 'SERVIE_LISTE_ATTENTE', 'SOUMISE', dto.motifHorsOrdre ?? null, {
        horsOrdre,
        partiel: brut !== r.montantBrut.toFixed(2) ? { avant: r.montantBrut.toFixed(2), apres: brut, accordMandataire: true } : null,
        derogation: derogation ? dto.motifDerogation : null,
      });
    });
    await this.tracer(u, 'LISTE_ATTENTE_SERVIE', `Réservation n° ${r.numero} servie depuis la liste d’attente${horsOrdre ? ', hors de l’ordre d’arrivée' : ''}.`, id, {
      motifHorsOrdre: dto.motifHorsOrdre ?? null,
      motifDerogation: dto.motifDerogation ?? null,
    });
    await this.notifications.decision(r, `réservation servie · ${r.enveloppe.nomProduit}`, [
      `Votre demande en liste d’attente est servie pour ${this.notifications.euros(net)} net. Elle passe en validation.`,
    ]);
    await this.enveloppes.verifierSeuils(r.enveloppeId);
    return this.detail(id, u);
  }

  // Taux et entité

  /** Seul l'administrateur modifie le taux d'une réservation, avec motif ; jamais sur sa propre ligne. */
  async modifierTaux(id: string, dto: TauxDto, u: UtilisateurConnecte) {
    exigerAdministrateur(u);
    const r = await this.decidable(id, u);
    if (['REFUSEE', 'ANNULEE', 'ANNULEE_APRES_OPERATION', 'LIBEREE'].includes(r.statut)) {
      throw new BadRequestException({ code: 'STATUT', message: 'Cette réservation est close.' });
    }
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { tauxCommission: dto.taux, tauxFigeLe: new Date() } });
      await this.historique(tx, r, u, 'TAUX_MODIFIE', null, dto.motif, { avant: r.tauxCommission.toString(), apres: dto.taux });
    });
    await this.tracer(u, 'TAUX_MODIFIE', `Taux de la réservation n° ${r.numero} modifié.`, id, { avant: r.tauxCommission.toString(), apres: dto.taux, motif: dto.motif });
    return this.detail(id, u);
  }

  async modifierEntite(id: string, dto: EntiteReservationDto, u: UtilisateurConnecte) {
    exigerGestion(u);
    const r = await this.reservation(id);
    const entite = await this.repository.prisma.entite.findUnique({ where: { id: dto.entiteId } });
    if (!entite) {
      throw new BadRequestException({ code: 'ENTITE', message: 'Entité inconnue.' });
    }
    await this.repository.transaction(async (tx) => {
      await tx.reservation.update({ where: { id }, data: { entiteId: entite.id } });
      await this.historique(tx, r, u, 'ENTITE_MODIFIEE', null, null, { avant: r.entite?.nom ?? null, apres: entite.nom });
    });
    return this.detail(id, u);
  }

  // Lecture

  ligne(r: ReservationComplete, u: UtilisateurConnecte) {
    const verifie = estVerifie(r.statut) && r.montantValide !== null;
    const definitive = r.statut === 'VERIFIEE' && r.montantValide !== null;
    const actif = ![...['REFUSEE', 'LIBEREE', 'ANNULEE', 'ANNULEE_APRES_OPERATION']].includes(r.statut);
    return {
      id: r.id,
      numero: r.numero,
      enveloppe: { id: r.enveloppe.id, nomProduit: r.enveloppe.nomProduit, compagnie: r.enveloppe.compagnie.nom, controlePatrimoine: r.enveloppe.controlePatrimoine },
      apporteur: { id: r.apporteur.id, nom: r.apporteur.nom, prenom: r.apporteur.prenom },
      entite: r.entite,
      typeOperation: r.typeOperation,
      typeClient: r.typeClient,
      clientNom: r.clientNom,
      clientPrenom: r.clientPrenom,
      numeroContrat: r.numeroContrat,
      numeroDemande: r.numeroDemande,
      codeApporteur: r.codeApporteur,
      gamme: r.gamme,
      montantBrut: texteMontant(r.montantBrut),
      tauxFrais: texteTaux(r.tauxFrais),
      montantNet: texteMontant(r.montantNet),
      clientPrevendu: r.clientPrevendu,
      encoursClient: texteMontant(r.encoursClient),
      partEncours: r.encoursClient && !r.encoursClient.isZero() ? part(r.montantNet, r.encoursClient).toDecimalPlaces(4).toString() : null,
      origineClient: r.origineClient,
      source: r.source,
      reservationGlobaleId: r.reservationGlobaleId,
      statut: r.statut,
      echeance: texteDate(r.echeance),
      tauxCommission: texteTaux(r.tauxCommission),
      tauxFige: !!r.tauxFigeLe,
      commissionEstimee: actif ? commission(verifie ? r.montantValide! : r.montantNet, r.tauxCommission).toFixed(2) : '0.00',
      commissionDefinitive: definitive ? commission(r.montantValide!, r.tauxCommission).toFixed(2) : null,
      accordAdministrateur: r.accordAdministrateur,
      modeArbitrage: r.modeArbitrage,
      pourcentageArbitrage: texteTaux(r.pourcentageArbitrage),
      valeurContrat: texteMontant(r.valeurContrat),
      fonds: r.fonds.map((f) => ({ ...f, montant: texteMontant(f.montant), pourcentage: texteTaux(f.pourcentage) })),
      accordClientLe: r.accordClientLe?.toISOString() ?? null,
      avenantVersion: r.avenantVersion,
      patrimoineAJour: r.patrimoineAJour,
      datePatrimoine: texteDate(r.datePatrimoine),
      dateOperation: texteDate(r.dateOperation),
      modeOperation: r.modeOperation,
      montantValide: texteMontant(r.montantValide),
      ecart: r.montantValide ? r.montantValide.minus(r.montantNet).toFixed(2) : null,
      ecartPct: r.montantValide ? part(r.montantValide.minus(r.montantNet), r.montantNet).toDecimalPlaces(4).toString() : null,
      dateValidationCompagnie: texteDate(r.dateValidationCompagnie),
      motif: r.motif ? { libelle: r.motif.libelle, categorie: r.motif.categorie } : null,
      commentaireMotif: r.commentaireMotif,
      motifEcart: r.motifEcart?.libelle ?? null,
      commentaireEcart: r.commentaireEcart,
      signalements: r.signalements,
      derogations: r.derogations,
      valideeLe: r.valideeLe?.toISOString() ?? null,
      annuleeLe: r.annuleeLe?.toISOString() ?? null,
      annulationTardive: r.annulationTardive,
      annulationImputable: r.annulationImputable,
      operationDeclareeLe: r.operationDeclareeLe?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      estApporteur: this.estApporteur(r, u),
    };
  }

  async lister(filtre: FiltreReservationsDto, u: UtilisateurConnecte) {
    const where: Prisma.ReservationWhereInput = {};
    if (filtre.enveloppe) where.enveloppeId = filtre.enveloppe;
    if (estGestion(u)) {
      if (filtre.apporteur) where.apporteurId = filtre.apporteur;
    } else {
      const moi = await this.referentiels.apporteurDeCompte(u.id);
      if (!moi) return [];
      where.apporteurId = moi.id;
    }
    const files: Record<string, Prisma.ReservationWhereInput['statut']> = {
      'a-valider': 'SOUMISE',
      'a-verifier': 'OPERATION_PASSEE',
      ecarts: 'ECART_A_JUSTIFIER',
      echues: 'ECHUE',
      attente: 'LISTE_ATTENTE',
      actives: { in: [...STATUTS_ACTIFS, 'LISTE_ATTENTE'] },
    };
    if (filtre.file && files[filtre.file]) where.statut = files[filtre.file];
    let liste = await this.repository.listerReservations(where);
    if (filtre.file === 'a-verifier') {
      // File de vérification : les plus anciennes d'abord.
      liste = [...liste].sort((a, b) => (a.operationDeclareeLe?.getTime() ?? 0) - (b.operationDeclareeLe?.getTime() ?? 0));
    }
    return liste.map((r) => this.ligne(r, u));
  }

  async detail(id: string, u: UtilisateurConnecte) {
    const r = await this.lisible(id, u);
    const [historique, documents] = await Promise.all([this.repository.historique(id), this.repository.documentsReservation(id)]);
    const gestion = estGestion(u);
    const proprietaire = this.estApporteur(r, u);
    return {
      ...this.ligne(r, u),
      enveloppe: {
        id: r.enveloppe.id,
        nomProduit: r.enveloppe.nomProduit,
        isin: r.enveloppe.isin,
        compagnie: r.enveloppe.compagnie,
        statut: r.enveloppe.statut,
        dateLimiteInterne: texteDate(r.enveloppe.dateLimiteInterne),
        controlePatrimoine: r.enveloppe.controlePatrimoine,
      },
      historique: historique.map((h) => ({
        id: h.id,
        date: h.createdAt.toISOString(),
        action: h.action,
        auteur: h.auteur,
        deStatut: h.deStatut,
        versStatut: h.versStatut,
        commentaire: h.commentaire,
        details: h.details,
      })),
      documents: documents.map((doc) => ({ ...doc, createdAt: doc.createdAt.toISOString() })),
      droits: {
        gestion,
        administrateur: estAdministrateur(u),
        decider: gestion && !proprietaire,
        valider: gestion && (!proprietaire || estSuperAdministrateur(u)) && (!r.accordAdministrateur || estAdministrateur(u)),
        modifier: gestion || proprietaire,
      },
    };
  }

  // Fiabilité

  async fiabilite(u: UtilisateurConnecte, apporteurId?: string) {
    let ids: string[];
    if (estGestion(u)) {
      ids = apporteurId ? [apporteurId] : (await this.repository.prisma.reservation.findMany({ distinct: ['apporteurId'], select: { apporteurId: true } })).map((x) => x.apporteurId);
    } else {
      const moi = await this.referentiels.apporteurDeCompte(u.id);
      if (!moi) return [];
      ids = [moi.id];
    }
    const maintenant = new Date();
    const resultats = [];
    for (const id of ids) {
      const [apporteur, reservations, historique] = await Promise.all([
        this.repository.prisma.apporteur.findUnique({ where: { id }, select: { id: true, nom: true, prenom: true, entite: { select: { nom: true } }, restreint: true } }),
        this.repository.prisma.reservation.findMany({
          where: { apporteurId: id },
          select: { statut: true, montantNet: true, montantValide: true, valideeLe: true, dateOperation: true, annulationTardive: true, annulationImputable: true, poidsAnnulation: true, signalements: true },
        }),
        this.repository.prisma.historiqueReservation.findMany({ where: { reservation: { apporteurId: id }, action: { in: ['BAISSE', 'PROLONGATION'] } }, select: { action: true, details: true } }),
      ]);
      if (!apporteur) continue;
      const f = calculerFiabilite({
        maintenant,
        lignes: reservations.map((r) => ({
          statut: r.statut,
          montantNet: r.montantNet,
          montantValide: r.montantValide,
          valideeLe: r.valideeLe,
          dateOperation: r.dateOperation ? depuisDateBase(r.dateOperation) : null,
          annulationTardive: r.annulationTardive,
          annulationImputable: r.annulationImputable,
          poidsAnnulation: r.poidsAnnulation,
          horsFiabilite: r.signalements.includes('PRODUIT_ANNULE_OU_REPORTE'),
        })),
        annulationsPartielles: historique
          .filter((h) => h.action === 'BAISSE' && h.details && typeof h.details === 'object' && 'montantRetire' in h.details)
          .map((h) => {
            const x = h.details as { montantRetire: string; tardive: boolean; imputable: boolean; poids?: number };
            return { montantRetire: x.montantRetire, tardive: x.tardive, imputable: x.imputable, poids: x.poids ?? (x.imputable ? 1 : 0) };
          }),
        prolongations: historique.filter((h) => h.action === 'PROLONGATION').length,
      });
      resultats.push({
        apporteur,
        tauxRealisation: f.tauxRealisation?.toDecimalPlaces(4).toString() ?? null,
        lignesComptees: f.lignesComptees,
        annulationsDansLesDelais: { nombre: f.annulationsDansLesDelais.nombre, montant: f.annulationsDansLesDelais.montant.toFixed(2) },
        annulationsTardives: { nombre: f.annulationsTardives.nombre, montant: f.annulationsTardives.montant.toFixed(2) },
        poidsAnnulations: f.poidsAnnulations,
        prolongations: f.prolongations,
        nonHonorees: { nombre: f.nonHonorees.nombre, montant: f.nonHonorees.montant.toFixed(2) },
        delaiMoyenJours: f.delaiMoyenJours,
      });
    }
    return resultats.sort((a, b) => `${a.apporteur.nom} ${a.apporteur.prenom}`.localeCompare(`${b.apporteur.nom} ${b.apporteur.prenom}`));
  }

  // Export

  /** Export CSV (Excel l'ouvre directement). Chaque export est journalisé : qui, quand, quelles lignes. */
  async exporter(filtre: FiltreReservationsDto, u: UtilisateurConnecte): Promise<string> {
    const lignes = await this.lister({ ...filtre, file: filtre.file ?? 'toutes' }, u);
    const gestion = estGestion(u);
    const colonnes: [string, (l: (typeof lignes)[number]) => string | null][] = [
      ['N°', (l) => String(l.numero)],
      ['Compagnie', (l) => l.enveloppe.compagnie],
      ['Produit', (l) => l.enveloppe.nomProduit],
      ['Apporteur', (l) => `${l.apporteur.prenom} ${l.apporteur.nom}`],
      ['Entité', (l) => l.entite?.nom ?? ''],
      ['Type', (l) => ({ ARBITRAGE: 'Arbitrage', VERSEMENT_LIBRE: 'Versement libre', AFFAIRE_NOUVELLE: 'Affaire nouvelle' })[l.typeOperation]],
      ['Client', (l) => [l.clientNom, l.clientPrenom].filter(Boolean).join(' ')],
      ['Contrat', (l) => l.numeroContrat],
      ['Code apporteur', (l) => l.codeApporteur?.code ?? ''],
      ['Montant brut', (l) => l.montantBrut],
      ['Frais', (l) => l.tauxFrais],
      ['Montant réservé (net)', (l) => l.montantNet],
      ['Montant validé', (l) => l.montantValide],
      ['Écart', (l) => l.ecart],
      ['Motif d’écart', (l) => l.motifEcart],
      ['Taux', (l) => l.tauxCommission],
      ['Commission estimée', (l) => l.commissionEstimee],
      ['Commission définitive', (l) => l.commissionDefinitive],
      ['Statut', (l) => LIBELLES_STATUTS[l.statut]],
      ['Échéance', (l) => l.echeance],
      ['Date de l’opération', (l) => l.dateOperation],
      ['Validation compagnie', (l) => l.dateValidationCompagnie],
      ['Origine', (l) => (l.origineClient === 'CONFIE' ? 'Client confié' : 'Client du mandataire')],
      ['Saisie le', (l) => l.createdAt.slice(0, 10)],
    ];
    const echapper = (v: string | null) => {
      const t = (v ?? '').replace(/"/g, '""');
      // Une cellule qui commence par = + - @ ne doit pas être lue comme une formule par le tableur.
      const sure = /^[=+\-@]/.test(t) && !/^-?\d/.test(t) ? `'${t}` : t;
      return /[;"\n]/.test(sure) ? `"${sure}"` : sure;
    };
    const csv = ['﻿' + colonnes.map(([t]) => echapper(t)).join(';'), ...lignes.map((l) => colonnes.map(([, f]) => echapper(f(l))).join(';'))].join('\r\n');
    await this.tracer(u, 'EXPORT_RESERVATIONS', `Export de ${lignes.length} réservation${lignes.length > 1 ? 's' : ''}${gestion ? '' : ' (les siennes)'}.`, filtre.enveloppe ?? 'toutes', {
      filtre: JSON.parse(JSON.stringify(filtre)),
      numeros: lignes.map((l) => l.numero),
    });
    return csv;
  }
}
