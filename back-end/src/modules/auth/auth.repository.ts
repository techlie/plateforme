import { Injectable } from '@nestjs/common';
import { MotifJeton, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

const AVEC_DROITS = { modules: { select: { module: true } }, entite: { select: { id: true, nom: true } } } as const;

export type UtilisateurAvecDroits = Prisma.UserGetPayload<{ include: typeof AVEC_DROITS }>;

/** Accès à la base pour la connexion, les codes, les sessions et les jetons. */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  trouverParEmail(email: string): Promise<UtilisateurAvecDroits | null> {
    return this.prisma.user.findUnique({ where: { email }, include: AVEC_DROITS });
  }

  enregistrerEchec(userId: string, echecs: number, bloqueJusqua: Date | null): Promise<unknown> {
    return this.prisma.user.update({ where: { id: userId }, data: { echecsConnexion: echecs, bloqueJusqua } });
  }

  remettreAZeroEchecs(userId: string): Promise<unknown> {
    return this.prisma.user.update({ where: { id: userId }, data: { echecsConnexion: 0, bloqueJusqua: null } });
  }

  /** Un nouveau code annule les précédents non utilisés. */
  async creerCode(userId: string, empreinte: string, expireLe: Date, maintenant: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.codeConnexion.updateMany({ where: { userId, utiliseLe: null }, data: { utiliseLe: maintenant } });
      return tx.codeConnexion.create({ data: { userId, empreinte, expireLe } });
    });
  }

  trouverCode(id: string) {
    return this.prisma.codeConnexion.findUnique({ where: { id }, include: { user: { include: AVEC_DROITS } } });
  }

  compterTentative(id: string, tentatives: number, utiliseLe: Date | null): Promise<unknown> {
    return this.prisma.codeConnexion.update({ where: { id }, data: { tentatives, utiliseLe } });
  }

  /** Le code ne sert qu'une fois : il n'est consommé que s'il ne l'a pas déjà été. */
  async consommerCode(id: string, maintenant: Date): Promise<boolean> {
    const resultat = await this.prisma.codeConnexion.updateMany({
      where: { id, utiliseLe: null },
      data: { utiliseLe: maintenant },
    });
    return resultat.count === 1;
  }

  creerSession(donnees: {
    userId: string;
    empreinteJeton: string;
    expireLe: Date;
    maintenant: Date;
    adresseIp: string | null;
    navigateur: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: donnees.userId }, data: { derniereConnexion: donnees.maintenant } });
      return tx.session.create({
        data: {
          userId: donnees.userId,
          empreinteJeton: donnees.empreinteJeton,
          expireLe: donnees.expireLe,
          derniereActivite: donnees.maintenant,
          adresseIp: donnees.adresseIp,
          navigateur: donnees.navigateur,
        },
      });
    });
  }

  trouverSession(empreinteJeton: string) {
    return this.prisma.session.findUnique({ where: { empreinteJeton }, include: { user: { include: AVEC_DROITS } } });
  }

  noterActivite(sessionId: string, maintenant: Date): Promise<unknown> {
    return this.prisma.session.update({ where: { id: sessionId }, data: { derniereActivite: maintenant } });
  }

  revoquerSession(sessionId: string, maintenant: Date): Promise<unknown> {
    return this.prisma.session.updateMany({ where: { id: sessionId, revoqueeLe: null }, data: { revoqueeLe: maintenant } });
  }

  revoquerSessions(userId: string, maintenant: Date): Promise<unknown> {
    return this.prisma.session.updateMany({ where: { userId, revoqueeLe: null }, data: { revoqueeLe: maintenant } });
  }

  /** Un nouveau lien annule les liens précédents non utilisés. */
  async creerJeton(userId: string, empreinte: string, motif: MotifJeton, expireLe: Date, maintenant: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.jetonMotDePasse.updateMany({ where: { userId, utiliseLe: null }, data: { utiliseLe: maintenant } });
      return tx.jetonMotDePasse.create({ data: { userId, empreinte, motif, expireLe } });
    });
  }

  trouverJeton(empreinte: string) {
    return this.prisma.jetonMotDePasse.findUnique({ where: { empreinte }, include: { user: true } });
  }

  /** Enregistre le mot de passe, consomme le lien et ferme toutes les sessions ouvertes. */
  async definirMotDePasse(jetonId: string, userId: string, empreinteMotDePasse: string, maintenant: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const consomme = await tx.jetonMotDePasse.updateMany({
        where: { id: jetonId, utiliseLe: null },
        data: { utiliseLe: maintenant },
      });
      if (consomme.count !== 1) return false;
      await tx.user.update({
        where: { id: userId },
        data: { motDePasse: empreinteMotDePasse, echecsConnexion: 0, bloqueJusqua: null },
      });
      await tx.session.updateMany({ where: { userId, revoqueeLe: null }, data: { revoqueeLe: maintenant } });
      return true;
    });
  }
}
