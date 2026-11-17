import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModulePlateforme, PROFILS_ADMINISTRATION, ProfilConnecte, ReponseConnexion } from './session.types';

/**
 * La personne connectée, telle que le serveur la décrit. L'écran s'en sert pour
 * afficher le bon menu ; les droits eux-mêmes sont toujours vérifiés par le serveur.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private chargement: Promise<ProfilConnecte | null> | null = null;

  readonly utilisateur = signal<ProfilConnecte | null>(null);
  readonly estAdministrateur = computed(() => {
    const u = this.utilisateur();
    return !!u && PROFILS_ADMINISTRATION.includes(u.profil);
  });

  /** Demande au serveur qui est connecté. Le résultat est gardé pour la suite de la visite. */
  charger(): Promise<ProfilConnecte | null> {
    this.chargement ??= firstValueFrom(this.http.get<ProfilConnecte>('/api/auth/moi'))
      .then((u) => {
        this.utilisateur.set(u);
        return u;
      })
      .catch(() => {
        this.utilisateur.set(null);
        return null;
      });
    return this.chargement;
  }

  aModule(module: ModulePlateforme): boolean {
    return this.utilisateur()?.modules.includes(module) ?? false;
  }

  connexion(email: string, motDePasse: string): Promise<ReponseConnexion> {
    return firstValueFrom(this.http.post<ReponseConnexion>('/api/auth/connexion', { email, motDePasse }));
  }

  async validerCode(demande: string, code: string): Promise<ProfilConnecte> {
    const u = await firstValueFrom(this.http.post<ProfilConnecte>('/api/auth/code', { demande, code }));
    this.utilisateur.set(u);
    this.chargement = Promise.resolve(u);
    return u;
  }

  async deconnexion(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/deconnexion', {}));
    } finally {
      this.oublier();
    }
  }

  /** Session expirée ou fermée par le serveur : l'écran revient à la connexion. */
  oublier(): void {
    this.utilisateur.set(null);
    this.chargement = Promise.resolve(null);
  }

  motDePasseOublie(email: string): Promise<{ message: string }> {
    return firstValueFrom(this.http.post<{ message: string }>('/api/auth/mot-de-passe-oublie', { email }));
  }

  verifierLien(jeton: string): Promise<{ motif: 'ACTIVATION' | 'REINITIALISATION'; prenom: string }> {
    return firstValueFrom(this.http.post<{ motif: 'ACTIVATION' | 'REINITIALISATION'; prenom: string }>('/api/auth/lien', { jeton }));
  }

  definirMotDePasse(jeton: string, motDePasse: string): Promise<void> {
    return firstValueFrom(this.http.post<void>('/api/auth/mot-de-passe', { jeton, motDePasse }));
  }
}
