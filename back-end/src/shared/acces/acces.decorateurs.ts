import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ModulePlateforme, Profil } from '@prisma/client';
import type { UtilisateurConnecte } from './acces.types';

export const CLE_PUBLIC = 'acces:public';
export const CLE_PROFILS = 'acces:profils';
export const CLE_MODULE = 'acces:module';

/** Route ouverte sans connexion (connexion elle-même, liens reçus par courriel). */
export const Public = () => SetMetadata(CLE_PUBLIC, true);

/** Route réservée à certains profils. */
export const Profils = (...profils: Profil[]) => SetMetadata(CLE_PROFILS, profils);

/** Route réservée aux comptes sur lesquels ce module est coché. */
export const ModuleRequis = (module: ModulePlateforme) => SetMetadata(CLE_MODULE, module);

/** La personne connectée, telle que le garde d'accès l'a vérifiée. */
export const UtilisateurCourant = createParamDecorator(
  (_donnee: unknown, contexte: ExecutionContext): UtilisateurConnecte =>
    contexte.switchToHttp().getRequest().utilisateur,
);
