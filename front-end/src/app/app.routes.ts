import { Routes } from '@angular/router';
import { connecteGuard, invitesGuard, moduleGuard, profilsGuard } from './core/acces.guards';
import { PROFILS_ADMINISTRATION, PROFILS_GESTION } from './core/session.types';

export const routes: Routes = [
  {
    path: 'connexion',
    title: 'Connexion · SR CONSEIL',
    canActivate: [invitesGuard],
    loadComponent: () => import('./modules/connexion/connexion.component').then((m) => m.ConnexionComponent),
  },
  {
    path: 'mot-de-passe-oublie',
    title: 'Mot de passe oublié · SR CONSEIL',
    loadComponent: () => import('./modules/connexion/mot-de-passe-oublie.component').then((m) => m.MotDePasseOublieComponent),
  },
  {
    path: 'activation',
    title: 'Créer votre accès · SR CONSEIL',
    loadComponent: () => import('./modules/connexion/definition-mot-de-passe.component').then((m) => m.DefinitionMotDePasseComponent),
  },
  {
    path: 'reinitialisation',
    title: 'Nouveau mot de passe · SR CONSEIL',
    loadComponent: () => import('./modules/connexion/definition-mot-de-passe.component').then((m) => m.DefinitionMotDePasseComponent),
  },
  {
    path: '',
    canActivate: [connecteGuard],
    loadComponent: () => import('./layout/coque/coque.component').then((m) => m.CoqueComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Accueil · SR CONSEIL',
        loadComponent: () => import('./modules/accueil/accueil.component').then((m) => m.AccueilComponent),
      },
      {
        path: 'simulateur',
        title: 'Simulateur · SR CONSEIL',
        canActivate: [moduleGuard('SIMULATEUR')],
        loadComponent: () => import('./modules/simulateur/simulateur.component').then((m) => m.SimulateurComponent),
      },
      {
        path: 'enveloppes',
        canActivate: [moduleGuard('ENVELOPPES')],
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Enveloppes · SR CONSEIL',
            loadComponent: () => import('./modules/enveloppes/tableau.component').then((m) => m.TableauEnveloppesComponent),
          },
          {
            path: 'nouvelle',
            title: 'Nouvelle enveloppe · SR CONSEIL',
            canActivate: [profilsGuard(...PROFILS_GESTION)],
            loadComponent: () => import('./modules/enveloppes/edition-enveloppe.component').then((m) => m.EditionEnveloppeComponent),
          },
          {
            path: 'fiabilite',
            title: 'Fiabilité · SR CONSEIL',
            canActivate: [profilsGuard(...PROFILS_GESTION)],
            loadComponent: () => import('./modules/enveloppes/fiabilite.component').then((m) => m.FiabiliteComponent),
          },
          {
            path: 'parametres',
            title: 'Paramètres des enveloppes · SR CONSEIL',
            canActivate: [profilsGuard(...PROFILS_ADMINISTRATION)],
            loadComponent: () => import('./modules/enveloppes/parametres.component').then((m) => m.ParametresEnveloppesComponent),
          },
          {
            path: 'reservations/:id',
            title: 'Réservation · SR CONSEIL',
            loadComponent: () => import('./modules/enveloppes/reservation.component').then((m) => m.ReservationComponent),
          },
          {
            path: ':id/reserver',
            title: 'Réserver · SR CONSEIL',
            loadComponent: () => import('./modules/enveloppes/reserver.component').then((m) => m.ReserverComponent),
          },
          {
            path: ':id/parametres',
            title: 'Paramétrer l’enveloppe · SR CONSEIL',
            canActivate: [profilsGuard(...PROFILS_GESTION)],
            loadComponent: () => import('./modules/enveloppes/edition-enveloppe.component').then((m) => m.EditionEnveloppeComponent),
          },
          {
            path: ':id',
            title: 'Enveloppe · SR CONSEIL',
            loadComponent: () => import('./modules/enveloppes/enveloppe.component').then((m) => m.EnveloppeComponent),
          },
        ],
      },
      {
        path: 'administration/referentiels',
        title: 'Référentiels · SR CONSEIL',
        canActivate: [profilsGuard(...PROFILS_ADMINISTRATION)],
        loadComponent: () => import('./modules/administration/referentiels.component').then((m) => m.ReferentielsComponent),
      },
      {
        path: 'administration/utilisateurs',
        title: 'Utilisateurs · SR CONSEIL',
        canActivate: [profilsGuard(...PROFILS_ADMINISTRATION)],
        loadComponent: () => import('./modules/administration/utilisateurs.component').then((m) => m.UtilisateursComponent),
      },
      {
        path: 'administration/journal',
        title: 'Journal · SR CONSEIL',
        canActivate: [profilsGuard(...PROFILS_ADMINISTRATION)],
        loadComponent: () => import('./modules/administration/journal.component').then((m) => m.JournalComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
