import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Catalogue, DemandeCalcul, Resultat } from './simulateur.types';

/** Appels au serveur pour le simulateur. Aucun calcul de commission n'est fait dans le navigateur. */
@Injectable({ providedIn: 'root' })
export class SimulateurApi {
  private readonly http = inject(HttpClient);

  contrats(): Observable<Catalogue> {
    return this.http.get<Catalogue>('/api/simulateur/contrats');
  }

  calculer(demande: DemandeCalcul): Observable<Resultat> {
    return this.http.post<Resultat>('/api/simulateur/calcul', demande);
  }
}
