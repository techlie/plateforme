import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const CLE = 'sr-conseil.theme';

/** Bascule entre l'affichage clair et l'affichage sombre, et retient le choix sur ce navigateur. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<Theme>(this.initial());

  constructor() {
    this.appliquer(this.theme());
  }

  basculer(): void {
    const suivant: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(suivant);
    this.appliquer(suivant);
    try {
      localStorage.setItem(CLE, suivant);
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour cette visite seulement.
    }
  }

  private initial(): Theme {
    try {
      const retenu = localStorage.getItem(CLE);
      if (retenu === 'dark' || retenu === 'light') {
        return retenu;
      }
    } catch {
      // Voir plus haut.
    }
    const vue = this.document.defaultView;
    return vue?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private appliquer(theme: Theme): void {
    this.document.documentElement.setAttribute('data-theme', theme);
  }
}
