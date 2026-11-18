import { ForbiddenException } from '@nestjs/common';
import type { Profil } from '@prisma/client';
import { PROFILS_ADMINISTRATION, UtilisateurConnecte } from '../../shared/acces/acces.types';

/** Profils qui gèrent les enveloppes : back-office et administrateurs. */
export const PROFILS_GESTION: Profil[] = [...PROFILS_ADMINISTRATION, 'BACK_OFFICE'];

export function estGestion(u: UtilisateurConnecte): boolean {
  return PROFILS_GESTION.includes(u.profil);
}

export function estAdministrateur(u: UtilisateurConnecte): boolean {
  return PROFILS_ADMINISTRATION.includes(u.profil);
}

export function estSuperAdministrateur(u: UtilisateurConnecte): boolean {
  return u.profil === 'SUPER_ADMINISTRATEUR';
}

/**
 * Séparation des tâches : personne ne décide seul sur sa propre production. L'apporteur d'une
 * réservation ne peut ni la valider, ni lui accorder une dérogation, ni saisir sa vérification,
 * ni modifier son taux, même s'il est administrateur. Seule exception, décidée le 18 novembre :
 * un super administrateur peut valider sa propre réservation (tracé, l'autre associé prévenu).
 */
export function interdireSurSaPropreReservation(u: UtilisateurConnecte, apporteurUserId: string | null): void {
  if (apporteurUserId && apporteurUserId === u.id) {
    throw new ForbiddenException({
      code: 'PROPRE_PRODUCTION',
      message: 'Vous ne pouvez pas décider sur votre propre réservation : un autre administrateur ou le back-office le fait.',
    });
  }
}

export function exigerGestion(u: UtilisateurConnecte): void {
  if (!estGestion(u)) {
    throw new ForbiddenException({ code: 'PROFIL', message: 'Action réservée au back-office et aux administrateurs.' });
  }
}

export function exigerAdministrateur(u: UtilisateurConnecte): void {
  if (!estAdministrateur(u)) {
    throw new ForbiddenException({ code: 'PROFIL', message: 'Action réservée aux administrateurs.' });
  }
}
