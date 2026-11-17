import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ENTREES_ADMINISTRATION, ENTREES_MODULES, ORDRE_MODULES } from '../../core/menu';
import { SessionService } from '../../core/session.service';

/** Accueil : les modules ouverts sur ce compte, et rien d'autre. */
@Component({
  selector: 'app-accueil',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header>
        <p class="surtitre">{{ utilisateur()?.entite?.nom ?? 'SR CONSEIL' }}</p>
        <h1 class="titre">Bonjour {{ utilisateur()?.prenom }}</h1>
      </header>

      @if (tuiles().length) {
        <ul class="tuiles">
          @for (tuile of tuiles(); track tuile.libelle) {
            <li>
              @if (tuile.lien) {
                <a class="tuile" [routerLink]="tuile.lien">
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
                    @for (trace of tuile.icone; track trace) {
                      <path [attr.d]="trace" />
                    }
                  </svg>
                  <strong>{{ tuile.libelle }}</strong>
                  <span>{{ tuile.description }}</span>
                </a>
              } @else {
                <div class="tuile tuile--a-venir">
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
                    @for (trace of tuile.icone; track trace) {
                      <path [attr.d]="trace" />
                    }
                  </svg>
                  <strong>{{ tuile.libelle }} <em>Bientôt</em></strong>
                  <span>{{ tuile.description }}</span>
                </div>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="note note--alerte">Aucun module n’est encore activé pour votre compte. Le cabinet peut l’activer depuis l’administration.</p>
      }
    </div>
  `,
  styles: `
    .page { max-width: 1120px; padding: 40px 48px 72px; display: flex; flex-direction: column; gap: 32px; }
    .surtitre { font-size: 14px; color: var(--texte-doux); }
    .titre { margin-top: 8px; font-size: 40px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; }
    .tuiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
    .tuile { height: 100%; padding: 20px; border-radius: var(--rayon-grand); border: 1px solid var(--bord); display: flex; flex-direction: column; gap: 10px; color: var(--texte); text-decoration: none; }
    a.tuile:hover { background: var(--surface-douce); }
    .tuile strong { font-size: 16px; font-weight: 600; }
    .tuile em { margin-left: 6px; padding: 2px 8px; border-radius: var(--rayon-pastille); background: var(--surface); font-size: 11px; font-style: normal; font-weight: 600; color: var(--texte-doux); }
    .tuile span { font-size: 13px; line-height: 1.5; color: var(--texte-doux); }
    .tuile--a-venir { color: var(--texte-doux); }
    svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    @media (max-width: 860px) { .page { padding: 24px 16px 48px; } .titre { font-size: 30px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccueilComponent {
  private readonly session = inject(SessionService);
  readonly utilisateur = this.session.utilisateur;

  readonly tuiles = computed(() => {
    const u = this.utilisateur();
    if (!u) return [];
    const modules = ORDRE_MODULES.filter((m) => u.modules.includes(m)).map((m) => ENTREES_MODULES[m]);
    return this.session.estAdministrateur() ? [...modules, ...ENTREES_ADMINISTRATION] : modules;
  });
}
