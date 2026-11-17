import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';
import { ModulePlateforme, Profil } from './session.types';

/** Écrans réservés aux personnes connectées. Sinon, retour à la connexion. */
export const connecteGuard: CanActivateFn = async (_route, etat) => {
  const session = inject(SessionService);
  const router = inject(Router);
  return (await session.charger()) ? true : router.createUrlTree(['/connexion'], { queryParams: { retour: etat.url } });
};

/** Écran de connexion : une personne déjà connectée va directement à l'accueil. */
export const invitesGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  return (await session.charger()) ? inject(Router).createUrlTree(['/']) : true;
};

export function moduleGuard(module: ModulePlateforme): CanActivateFn {
  return async () => {
    const session = inject(SessionService);
    const u = await session.charger();
    return u?.modules.includes(module) ? true : inject(Router).createUrlTree(['/']);
  };
}

export function profilsGuard(...profils: Profil[]): CanActivateFn {
  return async () => {
    const session = inject(SessionService);
    const u = await session.charger();
    return u && profils.includes(u.profil) ? true : inject(Router).createUrlTree(['/']);
  };
}
