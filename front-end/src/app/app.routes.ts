import { Routes } from '@angular/router';
import { connecteGuard, invitesGuard, moduleGuard, profilsGuard } from './core/acces.guards';
import { PROFILS_ADMINISTRATION } from './core/session.types';

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
