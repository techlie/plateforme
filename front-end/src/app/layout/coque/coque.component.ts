import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ENTREES_ADMINISTRATION, ENTREES_MODULES, EntreeMenu, ORDRE_MODULES } from '../../core/menu';
import { SessionService } from '../../core/session.service';
import { ThemeService } from '../../core/theme.service';
import { LogoComponent } from '../../shared/logo/logo.component';

/** Cadre commun aux écrans de la plateforme : menu latéral, selon les droits du compte, et zone de contenu. */
@Component({
  selector: 'app-coque',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoComponent],
  templateUrl: './coque.component.html',
  styleUrl: './coque.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoqueComponent {
  private readonly themes = inject(ThemeService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly ouvert = signal(true);
  readonly sombre = computed(() => this.themes.theme() === 'dark');
  readonly libelleTheme = computed(() => (this.sombre() ? 'Mode clair' : 'Mode sombre'));
  readonly utilisateur = this.session.utilisateur;

  readonly menu = computed<EntreeMenu[]>(() => {
    const u = this.utilisateur();
    if (!u) return [];
    const modules = ORDRE_MODULES.filter((m) => u.modules.includes(m)).map((m) => ENTREES_MODULES[m]);
    return this.session.estAdministrateur() ? [...modules, ...ENTREES_ADMINISTRATION] : modules;
  });

  basculerMenu(): void {
    this.ouvert.update((o) => !o);
  }

  basculerTheme(): void {
    this.themes.basculer();
  }

  async deconnecter(): Promise<void> {
    await this.session.deconnexion();
    await this.router.navigateByUrl('/connexion');
  }
}
