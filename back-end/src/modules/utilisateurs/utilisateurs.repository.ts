import { Injectable } from '@nestjs/common';
import { ModulePlateforme, Prisma, Profil } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

const FICHE = {
  id: true,
  email: true,
  nom: true,
  prenom: true,
  profil: true,
  actif: true,
  motDePasse: true,
  bloqueJusqua: true,
  derniereConnexion: true,
  createdAt: true,
  entite: { select: { id: true, nom: true } },
  modules: { select: { module: true } },
} as const;

export type LigneUtilisateur = Prisma.UserGetPayload<{ select: typeof FICHE }>;

@Injectable()
export class UtilisateursRepository {
  constructor(private readonly prisma: PrismaService) {}

  lister(): Promise<LigneUtilisateur[]> {
    return this.prisma.user.findMany({ select: FICHE, orderBy: [{ nom: 'asc' }, { prenom: 'asc' }] });
  }

  trouver(id: string): Promise<LigneUtilisateur | null> {
    return this.prisma.user.findUnique({ where: { id }, select: FICHE });
  }

  emailExiste(email: string): Promise<boolean> {
    return this.prisma.user.count({ where: { email } }).then((n) => n > 0);
  }

  entiteExiste(id: string): Promise<boolean> {
    return this.prisma.entite.count({ where: { id } }).then((n) => n > 0);
  }

  creer(donnees: {
    email: string;
    nom: string;
    prenom: string;
    profil: Profil;
    entiteId?: string;
    modules: ModulePlateforme[];
  }): Promise<LigneUtilisateur> {
    return this.prisma.user.create({
      data: {
        email: donnees.email,
        nom: donnees.nom,
        prenom: donnees.prenom,
        profil: donnees.profil,
        entiteId: donnees.entiteId ?? null,
        modules: { create: donnees.modules.map((module) => ({ module })) },
      },
      select: FICHE,
    });
  }

  /** Modifie la fiche ; les modules cochés sont remplacés en bloc. Ferme les sessions si demandé. */
  modifier(
    id: string,
    donnees: Prisma.UserUncheckedUpdateInput,
    modules: ModulePlateforme[] | undefined,
    fermerSessions: boolean,
  ): Promise<LigneUtilisateur> {
    return this.prisma.$transaction(async (tx) => {
      if (modules) {
        await tx.moduleUtilisateur.deleteMany({ where: { userId: id } });
        await tx.moduleUtilisateur.createMany({ data: modules.map((module) => ({ userId: id, module })) });
      }
      if (fermerSessions) {
        await tx.session.updateMany({ where: { userId: id, revoqueeLe: null }, data: { revoqueeLe: new Date() } });
        await tx.appareilReconnu.updateMany({ where: { userId: id, revoqueLe: null }, data: { revoqueLe: new Date() } });
      }
      return tx.user.update({ where: { id }, data: donnees, select: FICHE });
    });
  }
}
