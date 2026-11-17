import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ModulePlateforme, Profil } from '@prisma/client';
import type { Request } from 'express';
import { CLE_MODULE, CLE_MODULE_SAUF_ADMINISTRATION, CLE_PROFILS, CLE_PUBLIC } from '../../../shared/acces/acces.decorateurs';
import { PROFILS_ADMINISTRATION } from '../../../shared/acces/acces.types';
import { lireCookie, NOM_COOKIE_SESSION } from '../../../shared/acces/requete';
import { AuthService } from '../auth.service';

/**
 * Garde posé sur toutes les routes : sans session valable, rien ne passe, sauf ce qui
 * est marqué @Public. Il vérifie ensuite le profil et le module demandés par la route.
 * Le filtrage se fait ici, côté serveur, jamais seulement à l'écran.
 */
@Injectable()
export class AccesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const cibles = [contexte.getHandler(), contexte.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, cibles)) {
      return true;
    }

    const requete = contexte.switchToHttp().getRequest<Request & { utilisateur?: unknown }>();
    const jeton = lireCookie(requete, NOM_COOKIE_SESSION);
    const utilisateur = jeton ? await this.auth.utilisateurDeSession(jeton) : null;
    if (!utilisateur) {
      throw new UnauthorizedException({ code: 'NON_CONNECTE', message: 'Connectez-vous pour continuer.' });
    }
    requete.utilisateur = utilisateur;

    const profils = this.reflector.getAllAndOverride<Profil[] | undefined>(CLE_PROFILS, cibles);
    if (profils && !profils.includes(utilisateur.profil)) {
      throw new ForbiddenException({ code: 'PROFIL', message: "Votre profil ne donne pas accès à cette page." });
    }

    const module = this.reflector.getAllAndOverride<ModulePlateforme | undefined>(CLE_MODULE, cibles);
    const saufAdministration = this.reflector.getAllAndOverride<boolean | undefined>(CLE_MODULE_SAUF_ADMINISTRATION, cibles);
    const administrateur = PROFILS_ADMINISTRATION.includes(utilisateur.profil);
    if (module && !utilisateur.modules.includes(module) && !(saufAdministration && administrateur)) {
      throw new ForbiddenException({ code: 'MODULE', message: "Ce module n'est pas activé pour votre compte." });
    }
    return true;
  }
}
