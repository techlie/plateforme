import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../../core/theme.service';

interface EntreeMenu {
  libelle: string;
  /** Tracé de l'icône, dans une grille de 24 × 24. */
  icone: string[];
  lien?: string;
}

/** Cadre commun à tous les écrans : menu latéral et zone de contenu. */
@Component({
  selector: 'app-coque',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './coque.component.html',
  styleUrl: './coque.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoqueComponent {
  private readonly themes = inject(ThemeService);

  readonly ouvert = signal(true);
  readonly sombre = computed(() => this.themes.theme() === 'dark');
  readonly libelleTheme = computed(() => (this.sombre() ? 'Mode clair' : 'Mode sombre'));

  /** Les modules sans lien ne sont pas encore construits : ils sont annoncés, pas cliquables. */
  readonly menu: EntreeMenu[] = [
    { libelle: 'Accueil', icone: ['M3 11l9-7 9 7', 'M5 10v10h14V10'] },
    { libelle: 'Enveloppes', icone: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'] },
    {
      libelle: 'Simulateur',
      lien: '/simulateur',
      icone: ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8 7h8', 'M8 12h2', 'M14 12h2', 'M8 16h2', 'M14 16h2'],
    },
    { libelle: 'Mes affaires', icone: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'] },
    { libelle: 'Bordereau', icone: ['M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M3 10h18', 'M16 15h2'] },
    { libelle: 'Documents', icone: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'] },
  ];

  basculerMenu(): void {
    this.ouvert.update((o) => !o);
  }

  basculerTheme(): void {
    this.themes.basculer();
  }
}
