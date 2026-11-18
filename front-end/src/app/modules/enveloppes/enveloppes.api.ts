import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Apercu,
  Apporteur,
  CategorieDocument,
  CategorieMotif,
  ClientConfie,
  CodeApporteur,
  Compagnie,
  Convention,
  DetailReservation,
  DocumentDepose,
  Enveloppe,
  Fiabilite,
  Fonds,
  Motif,
  Parametres,
  Reservation,
} from './enveloppes.types';

type Corps = Record<string, unknown>;

/** Accès au serveur du module Enveloppes et aux référentiels. */
@Injectable({ providedIn: 'root' })
export class EnveloppesApi {
  private readonly http = inject(HttpClient);

  private get<T>(url: string, params?: Record<string, string | undefined>): Promise<T> {
    let p = new HttpParams();
    for (const [cle, valeur] of Object.entries(params ?? {})) {
      if (valeur) p = p.set(cle, valeur);
    }
    return firstValueFrom(this.http.get<T>(`/api${url}`, { params: p }));
  }

  private post<T>(url: string, corps: Corps | FormData = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`/api${url}`, corps));
  }

  private patch<T>(url: string, corps: Corps): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`/api${url}`, corps));
  }

  // Enveloppes
  enveloppes = () => this.get<Enveloppe[]>('/enveloppes');
  enveloppe = (id: string) => this.get<Enveloppe>(`/enveloppes/${id}`);
  creerEnveloppe = (corps: Corps) => this.post<Enveloppe>('/enveloppes', corps);
  modifierEnveloppe = (id: string, corps: Corps) => this.patch<Enveloppe>(`/enveloppes/${id}`, corps);
  ouvrir = (id: string) => this.post<Enveloppe>(`/enveloppes/${id}/ouverture`);
  cloturer = (id: string) => this.post<Enveloppe>(`/enveloppes/${id}/cloture`);
  statutProduit = (id: string, corps: Corps) => this.post<Enveloppe>(`/enveloppes/${id}/statut-produit`, corps);
  mouvement = (id: string, corps: Corps) => this.post<Enveloppe>(`/enveloppes/${id}/mouvements`, corps);
  upfront = (id: string, taux: string) => firstValueFrom(this.http.put<Enveloppe>(`/api/enveloppes/${id}/upfront`, { taux }));
  creerGlobale = (id: string, corps: Corps) => this.post<Enveloppe>(`/enveloppes/${id}/globales`, corps);
  libererGlobale = (id: string, corps: Corps) => this.post<Enveloppe>(`/enveloppes/globales/${id}/liberation`, corps);
  prolongerGlobale = (id: string, corps: Corps) => this.post<Enveloppe>(`/enveloppes/globales/${id}/prolongation`, corps);
  globalesDisponibles = (id: string, apporteur?: string) =>
    this.get<{ id: string; montant: string; consomme: string; solde: string; echeance: string }[]>(`/enveloppes/${id}/globales-disponibles`, { apporteur });
  listeAttente = (id: string) => this.get<Reservation[]>(`/enveloppes/${id}/liste-attente`);
  clientsConfies = (enveloppe?: string) => this.get<ClientConfie[]>('/enveloppes/clients-confies', { enveloppe });
  confier = (id: string, corps: Corps) => this.post<ClientConfie>(`/enveloppes/${id}/clients-confies`, corps);
  retirerConfie = (id: string) => this.post<void>(`/enveloppes/clients-confies/${id}/retrait`);
  fiabilite = (apporteur?: string) => this.get<Fiabilite[]>('/enveloppes/fiabilite', { apporteur });
  parametres = () => this.get<Parametres>('/enveloppes/parametres');
  modifierParametres = (corps: Corps) => this.patch<Parametres>('/enveloppes/parametres', corps);
  validerEmailing = () => this.post<Parametres>('/enveloppes/parametres/emailing');
  motifs = (categorie?: CategorieMotif) => this.get<Motif[]>('/enveloppes/motifs', { categorie });
  creerMotif = (corps: Corps) => this.post<Motif>('/enveloppes/motifs', corps);
  modifierMotif = (id: string, corps: Corps) => this.patch<Motif>(`/enveloppes/motifs/${id}`, corps);

  deposerDocumentEnveloppe(id: string, categorie: CategorieDocument, fichier: File): Promise<DocumentDepose> {
    const corps = new FormData();
    corps.append('categorie', categorie);
    corps.append('fichier', fichier);
    return this.post<DocumentDepose>(`/enveloppes/${id}/documents`, corps);
  }

  deposerDocumentReservation(id: string, categorie: CategorieDocument, fichier: File): Promise<DocumentDepose> {
    const corps = new FormData();
    corps.append('categorie', categorie);
    corps.append('fichier', fichier);
    return this.post<DocumentDepose>(`/reservations/${id}/documents`, corps);
  }

  lienDocument = (id: string) => `/api/enveloppes/documents/${id}`;
  lienAvenant = (id: string) => `/api/reservations/${id}/avenant`;

  lienExport(filtre: { enveloppe?: string; file?: string; apporteur?: string }): string {
    const p = new URLSearchParams(Object.entries(filtre).filter(([, v]) => !!v) as [string, string][]);
    return `/api/reservations/export${p.toString() ? `?${p}` : ''}`;
  }

  // Réservations
  apercu = (corps: Corps) => this.post<Apercu>('/reservations/apercu', corps);
  reserver = (corps: Corps) => this.post<DetailReservation>('/reservations', corps);
  reservations = (filtre: { enveloppe?: string; file?: string; apporteur?: string } = {}) => this.get<Reservation[]>('/reservations', filtre);
  reservation = (id: string) => this.get<DetailReservation>(`/reservations/${id}`);
  modifierReservation = (id: string, corps: Corps) => this.patch<DetailReservation>(`/reservations/${id}`, corps);
  action = (id: string, action: string, corps: Corps = {}) => this.post<DetailReservation>(`/reservations/${id}/${action}`, corps);

  // Référentiels
  compagnies = () => this.get<Compagnie[]>('/referentiels/compagnies');
  creerCompagnie = (corps: Corps) => this.post<Compagnie>('/referentiels/compagnies', corps);
  modifierCompagnie = (id: string, corps: Corps) => this.patch<Compagnie>(`/referentiels/compagnies/${id}`, corps);
  ajouterGamme = (id: string, nom: string) => this.post(`/referentiels/compagnies/${id}/gammes`, { nom });
  modifierGamme = (id: string, corps: Corps) => this.patch(`/referentiels/gammes/${id}`, corps);
  moi = () => this.get<Apporteur | null>('/referentiels/apporteurs/moi');
  apporteurs = () => this.get<Apporteur[]>('/referentiels/apporteurs');
  creerApporteur = (corps: Corps) => this.post<Apporteur>('/referentiels/apporteurs', corps);
  modifierApporteur = (id: string, corps: Corps) => this.patch<Apporteur>(`/referentiels/apporteurs/${id}`, corps);
  codesValables = (compagnie: string, apporteur?: string) => this.get<{ id: string; code: string; nature: string }[]>('/referentiels/codes-valables', { compagnie, apporteur });
  codes = (compagnie?: string) => this.get<CodeApporteur[]>('/referentiels/codes', { compagnie });
  creerCode = (corps: Corps) => this.post<CodeApporteur>('/referentiels/codes', corps);
  modifierCode = (id: string, corps: Corps) => this.patch<CodeApporteur>(`/referentiels/codes/${id}`, corps);
  fonds = (compagnie: string) => this.get<Fonds[]>('/referentiels/fonds', { compagnie });
  conventions = (apporteur: string) => this.get<Convention[]>(`/referentiels/apporteurs/${apporteur}/conventions`);
  mesConventions = () => this.get<Convention[]>('/referentiels/conventions/miennes');
  lienConvention = (document: string) => `/api/referentiels/conventions/documents/${document}`;

  ajouterConvention(apporteur: string, champs: { dateEffet: string; tauxClientsConfies?: string; commentaire?: string }, fichier: File): Promise<Convention> {
    const corps = new FormData();
    for (const [cle, valeur] of Object.entries(champs)) {
      if (valeur) corps.append(cle, valeur);
    }
    corps.append('fichier', fichier);
    return this.post<Convention>(`/referentiels/apporteurs/${apporteur}/conventions`, corps);
  }
  ajouterFonds = (corps: Corps) => this.post<Fonds>('/referentiels/fonds', corps);
  importerFonds = (corps: Corps) =>
    this.post<{
      ajouts: { nom: string }[];
      renommages: { ancienNom: string; nouveauNom: string }[];
      fermetures: { nom: string }[];
      reouvertures: { nom: string }[];
      doublons: string[];
      isinInvalides: string[];
      applique: boolean;
    }>('/referentiels/fonds/import', corps);
}

/** Détail des contrôles renvoyés par le serveur quand une saisie est refusée (422). */
export function controlesRefuses(erreur: unknown): { bloquants: { code: string; message: string }[]; derogeables: { code: string; message: string }[] } | null {
  const corps = (erreur as { error?: { code?: string; bloquants?: unknown; derogeables?: unknown } })?.error;
  if (corps?.code !== 'CONTROLES') return null;
  return {
    bloquants: (corps.bloquants as { code: string; message: string }[]) ?? [],
    derogeables: (corps.derogeables as { code: string; message: string }[]) ?? [],
  };
}

export function codeErreur(erreur: unknown): string | null {
  return (erreur as { error?: { code?: string } })?.error?.code ?? null;
}
