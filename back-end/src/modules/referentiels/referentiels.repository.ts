import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

const APPORTEUR = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  role: true,
  restreint: true,
  habiliteReservationGlobale: true,
  actif: true,
  entite: { select: { id: true, nom: true } },
  user: { select: { id: true, email: true, actif: true } },
  codes: { select: { code: { select: { id: true, code: true, nature: true, actif: true, compagnieId: true } } } },
} as const;

export type LigneApporteur = Prisma.ApporteurGetPayload<{ select: typeof APPORTEUR }>;

const CODE = {
  id: true,
  code: true,
  nature: true,
  dateDebut: true,
  dateFin: true,
  actif: true,
  compagnie: { select: { id: true, nom: true } },
  autorises: { select: { apporteur: { select: { id: true, nom: true, prenom: true } } } },
} as const;

export type LigneCode = Prisma.CodeApporteurGetPayload<{ select: typeof CODE }>;

@Injectable()
export class ReferentielsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Compagnies et gammes

  listerCompagnies() {
    return this.prisma.compagnie.findMany({
      orderBy: { nom: 'asc' },
      include: { gammes: { orderBy: { nom: 'asc' } } },
    });
  }

  trouverCompagnie(id: string) {
    return this.prisma.compagnie.findUnique({ where: { id }, include: { gammes: { orderBy: { nom: 'asc' } } } });
  }

  compagnieParNom(nom: string) {
    return this.prisma.compagnie.findFirst({ where: { nom: { equals: nom, mode: 'insensitive' } } });
  }

  creerCompagnie(data: Prisma.CompagnieCreateInput) {
    return this.prisma.compagnie.create({ data, include: { gammes: true } });
  }

  modifierCompagnie(id: string, data: Prisma.CompagnieUpdateInput) {
    return this.prisma.compagnie.update({ where: { id }, data, include: { gammes: { orderBy: { nom: 'asc' } } } });
  }

  gammeParNom(compagnieId: string, nom: string) {
    return this.prisma.gamme.findFirst({ where: { compagnieId, nom: { equals: nom, mode: 'insensitive' } } });
  }

  trouverGamme(id: string) {
    return this.prisma.gamme.findUnique({ where: { id } });
  }

  creerGamme(compagnieId: string, nom: string) {
    return this.prisma.gamme.create({ data: { compagnieId, nom } });
  }

  modifierGamme(id: string, data: Prisma.GammeUpdateInput) {
    return this.prisma.gamme.update({ where: { id }, data });
  }

  // Apporteurs

  listerApporteurs() {
    return this.prisma.apporteur.findMany({ select: APPORTEUR, orderBy: [{ nom: 'asc' }, { prenom: 'asc' }] });
  }

  trouverApporteur(id: string): Promise<LigneApporteur | null> {
    return this.prisma.apporteur.findUnique({ where: { id }, select: APPORTEUR });
  }

  apporteurDeCompte(userId: string): Promise<LigneApporteur | null> {
    return this.prisma.apporteur.findUnique({ where: { userId }, select: APPORTEUR });
  }

  compteExiste(userId: string) {
    return this.prisma.user.count({ where: { id: userId } }).then((n) => n > 0);
  }

  entiteExiste(id: string) {
    return this.prisma.entite.count({ where: { id } }).then((n) => n > 0);
  }

  creerApporteur(data: Prisma.ApporteurUncheckedCreateInput) {
    return this.prisma.apporteur.create({ data, select: APPORTEUR });
  }

  modifierApporteur(id: string, data: Prisma.ApporteurUncheckedUpdateInput) {
    return this.prisma.apporteur.update({ where: { id }, data, select: APPORTEUR });
  }

  // Codes apporteur

  listerCodes(compagnieId?: string): Promise<LigneCode[]> {
    return this.prisma.codeApporteur.findMany({
      where: compagnieId ? { compagnieId } : undefined,
      select: CODE,
      orderBy: [{ compagnie: { nom: 'asc' } }, { code: 'asc' }],
    });
  }

  trouverCode(id: string): Promise<LigneCode | null> {
    return this.prisma.codeApporteur.findUnique({ where: { id }, select: CODE });
  }

  codeExiste(compagnieId: string, code: string) {
    return this.prisma.codeApporteur.findFirst({ where: { compagnieId, code: { equals: code, mode: 'insensitive' } } });
  }

  apporteursExistent(ids: string[]) {
    return this.prisma.apporteur.count({ where: { id: { in: ids } } }).then((n) => n === new Set(ids).size);
  }

  creerCode(data: Prisma.CodeApporteurUncheckedCreateInput, apporteurIds: string[]) {
    return this.prisma.codeApporteur.create({
      data: { ...data, autorises: { create: [...new Set(apporteurIds)].map((apporteurId) => ({ apporteurId })) } },
      select: CODE,
    });
  }

  modifierCode(id: string, data: Prisma.CodeApporteurUncheckedUpdateInput, apporteurIds?: string[]) {
    return this.prisma.$transaction(async (tx) => {
      if (apporteurIds) {
        await tx.codeApporteurAutorise.deleteMany({ where: { codeId: id } });
        await tx.codeApporteurAutorise.createMany({ data: [...new Set(apporteurIds)].map((apporteurId) => ({ codeId: id, apporteurId })) });
      }
      return tx.codeApporteur.update({ where: { id }, data, select: CODE });
    });
  }

  /** Codes actifs qu'un apporteur peut utiliser chez une compagnie. */
  codesAutorises(apporteurId: string, compagnieId: string) {
    return this.prisma.codeApporteur.findMany({
      where: { compagnieId, actif: true, autorises: { some: { apporteurId } } },
      select: { id: true, code: true, nature: true, dateDebut: true, dateFin: true },
      orderBy: { code: 'asc' },
    });
  }

  // Fonds

  listerFonds(compagnieId: string) {
    return this.prisma.fonds.findMany({
      where: { compagnieId },
      select: { id: true, nom: true, isin: true, ouvert: true, dateFermeture: true, origine: true, anciensNoms: true },
      orderBy: [{ ouvert: 'desc' }, { nom: 'asc' }],
    });
  }

  fondsConnus(compagnieId: string) {
    return this.prisma.fonds.findMany({ where: { compagnieId }, select: { id: true, cle: true, nom: true, ouvert: true, anciensNoms: true } });
  }

  trouverFondsParCle(compagnieId: string, cle: string) {
    return this.prisma.fonds.findUnique({ where: { compagnieId_cle: { compagnieId, cle } } });
  }

  creerFonds(data: Prisma.FondsUncheckedCreateInput) {
    return this.prisma.fonds.create({ data });
  }

  transaction<T>(travail: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(travail);
  }
}
