import { Injectable } from '@nestjs/common';
import { Prisma, StatutReservation } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

export type Db = Prisma.TransactionClient | PrismaService;

export const SELECTION_ENVELOPPE = {
  compagnie: { select: { id: true, nom: true, formatNumeroContrat: true, exempleNumeroContrat: true, gammes: { where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: 'asc' } } } },
  gammesExclues: { select: { gamme: { select: { id: true, nom: true } } } },
  documents: { select: { id: true, categorie: true, nom: true, typeMime: true, taille: true, createdAt: true, auteur: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.EnveloppeInclude;

export type EnveloppeComplete = Prisma.EnveloppeGetPayload<{ include: typeof SELECTION_ENVELOPPE }>;

export const SELECTION_RESERVATION = {
  enveloppe: { select: { id: true, nomProduit: true, isin: true, statut: true, dateLimiteInterne: true, controlePatrimoine: true, compagnie: { select: { id: true, nom: true } } } },
  apporteur: { select: { id: true, nom: true, prenom: true, userId: true, restreint: true, entiteId: true, email: true, user: { select: { email: true, actif: true } } } },
  entite: { select: { id: true, nom: true } },
  codeApporteur: { select: { id: true, code: true } },
  gamme: { select: { id: true, nom: true } },
  motif: { select: { id: true, libelle: true, imputabilite: true, categorie: true } },
  motifEcart: { select: { id: true, libelle: true } },
  reservationGlobale: { select: { id: true, montant: true, montantLibere: true } },
  clientConfie: { select: { id: true, taux: true } },
  fonds: { select: { id: true, fondsId: true, nom: true, isin: true, montant: true, pourcentage: true, horsReferentiel: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ReservationInclude;

export type ReservationComplete = Prisma.ReservationGetPayload<{ include: typeof SELECTION_RESERVATION }>;

export const CHAMPS_COMPTEURS = {
  statut: true,
  montantNet: true,
  montantValide: true,
  source: true,
  reservationGlobaleId: true,
} satisfies Prisma.ReservationSelect;

@Injectable()
export class EnveloppesRepository {
  constructor(readonly prisma: PrismaService) {}

  transaction<T>(travail: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(travail, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 });
  }

  /** Verrouille l'enveloppe le temps de la transaction : deux réservations ne prennent jamais le même montant. */
  async verrouiller(tx: Prisma.TransactionClient, enveloppeId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "enveloppes" WHERE "id" = ${enveloppeId}::uuid FOR UPDATE`;
  }

  parametres(db: Db = this.prisma) {
    return db.parametresEnveloppes.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  trouverEnveloppe(id: string, db: Db = this.prisma): Promise<EnveloppeComplete | null> {
    return db.enveloppe.findUnique({ where: { id }, include: SELECTION_ENVELOPPE });
  }

  listerEnveloppes(statuts?: Prisma.EnveloppeWhereInput['statut']) {
    return this.prisma.enveloppe.findMany({
      where: statuts ? { statut: statuts } : undefined,
      include: SELECTION_ENVELOPPE,
      orderBy: [{ dateLimiteInterne: 'asc' }, { nomProduit: 'asc' }],
    });
  }

  /** Tout ce qu'il faut pour calculer les deux compteurs d'une enveloppe. */
  async donneesCompteurs(enveloppeId: string, db: Db = this.prisma) {
    // Requêtes l'une après l'autre : dans une transaction, elles partagent une seule connexion.
    const enveloppe = await db.enveloppe.findUniqueOrThrow({ where: { id: enveloppeId }, select: { montantInitial: true } });
    const mouvements = await db.mouvementEnveloppe.findMany({ where: { enveloppeId }, select: { type: true, montant: true } });
    const reservations = await db.reservation.findMany({ where: { enveloppeId }, select: { id: true, ...CHAMPS_COMPTEURS } });
    const globales = await db.reservationGlobale.findMany({ where: { enveloppeId }, select: { id: true, montant: true, montantLibere: true } });
    return { montantInitial: enveloppe.montantInitial, mouvements, reservations, globales };
  }

  trouverReservation(id: string, db: Db = this.prisma): Promise<ReservationComplete | null> {
    return db.reservation.findUnique({ where: { id }, include: SELECTION_RESERVATION });
  }

  listerReservations(where: Prisma.ReservationWhereInput) {
    return this.prisma.reservation.findMany({ where, include: SELECTION_RESERVATION, orderBy: [{ createdAt: 'asc' }] });
  }

  historique(reservationId: string) {
    return this.prisma.historiqueReservation.findMany({ where: { reservationId }, orderBy: { createdAt: 'asc' } });
  }

  documentsReservation(reservationId: string) {
    return this.prisma.document.findMany({
      where: { reservationId },
      select: { id: true, categorie: true, nom: true, typeMime: true, taille: true, createdAt: true, auteur: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  ecrireHistorique(
    db: Db,
    entree: { reservationId: string; action: string; auteurId: string | null; auteur: string; deStatut?: StatutReservation | null; versStatut?: StatutReservation | null; commentaire?: string | null; details?: Prisma.InputJsonValue },
  ) {
    return db.historiqueReservation.create({
      data: {
        reservationId: entree.reservationId,
        action: entree.action,
        auteurId: entree.auteurId,
        auteur: entree.auteur,
        deStatut: entree.deStatut ?? null,
        versStatut: entree.versStatut ?? null,
        commentaire: entree.commentaire ?? null,
        details: entree.details,
      },
    });
  }

  motif(id: string, db: Db = this.prisma) {
    return db.motif.findUnique({ where: { id } });
  }
}
