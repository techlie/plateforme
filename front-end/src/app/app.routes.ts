import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'simulateur' },
  {
    path: 'simulateur',
    title: 'Simulateur · SR CONSEIL',
    loadComponent: () => import('./modules/simulateur/simulateur.component').then((m) => m.SimulateurComponent),
  },
  { path: '**', redirectTo: 'simulateur' },
];
