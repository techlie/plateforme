import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from './session.service';

/** Si le serveur répond que la session n'est plus valable, l'écran revient à la connexion. */
export const sessionInterceptor: HttpInterceptorFn = (requete, suite) => {
  const session = inject(SessionService);
  const router = inject(Router);
  return suite(requete).pipe(
    catchError((erreur: unknown) => {
      if (
        erreur instanceof HttpErrorResponse &&
        erreur.status === 401 &&
        (erreur.error as { code?: string } | null)?.code === 'NON_CONNECTE' &&
        session.utilisateur()
      ) {
        session.oublier();
        void router.navigate(['/connexion'], { queryParams: { retour: router.url } });
      }
      return throwError(() => erreur);
    }),
  );
};
