import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModulePlateforme, Profil } from '../../core/session.types';

export interface FicheUtilisateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  profil: Profil;
  actif: boolean;
  compteActive: boolean;
  bloque: boolean;
  entite: { id: string; nom: string } | null;
  modules: ModulePlateforme[];
  derniereConnexion: string | null;
  createdAt: string;
}

export interface Entite {
  id: string;
  nom: string;
  orias: string | null;
  membreSofraco: boolean;
  actif: boolean;
}

export interface LigneJournal {
  id: string;
  date: string;
  action: string;
  message: string;
  statut: 'SUCCES' | 'ECHEC';
  auteur: string | null;
  cible: string | null;
  adresseIp: string | null;
}

export interface PageJournal {
  page: number;
  parPage: number;
  total: number;
  lignes: LigneJournal[];
}

export interface CreationUtilisateur {
  email: string;
  nom: string;
  prenom: string;
  profil: Profil;
  entiteId?: string;
  modules: ModulePlateforme[];
}

export type ModificationUtilisateur = Partial<Omit<CreationUtilisateur, 'email' | 'entiteId'>> & {
  entiteId?: string | null;
  actif?: boolean;
};

/** Appels au serveur pour l'administration. Le serveur vérifie lui-même les droits. */
@Injectable({ providedIn: 'root' })
export class AdministrationApi {
  private readonly http = inject(HttpClient);

  utilisateurs(): Promise<FicheUtilisateur[]> {
    return firstValueFrom(this.http.get<FicheUtilisateur[]>('/api/utilisateurs'));
  }

  creerUtilisateur(donnees: CreationUtilisateur): Promise<FicheUtilisateur> {
    return firstValueFrom(this.http.post<FicheUtilisateur>('/api/utilisateurs', donnees));
  }

  modifierUtilisateur(id: string, donnees: ModificationUtilisateur): Promise<FicheUtilisateur> {
    return firstValueFrom(this.http.patch<FicheUtilisateur>(`/api/utilisateurs/${id}`, donnees));
  }

  renvoyerLien(id: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/utilisateurs/${id}/lien`, {}));
  }

  entites(): Promise<Entite[]> {
    return firstValueFrom(this.http.get<Entite[]>('/api/entites'));
  }

  creerEntite(nom: string): Promise<Entite> {
    return firstValueFrom(this.http.post<Entite>('/api/entites', { nom }));
  }

  journal(page: number, action?: string): Promise<PageJournal> {
    const parametres: Record<string, string> = { page: String(page), parPage: '50' };
    if (action) parametres['action'] = action;
    return firstValueFrom(this.http.get<PageJournal>('/api/journal', { params: parametres }));
  }
}

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function dateLisible(iso: string | null): string {
  return iso ? FORMAT_DATE.format(new Date(iso)) : '—';
}
