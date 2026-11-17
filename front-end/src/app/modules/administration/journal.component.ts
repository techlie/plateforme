import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { messageErreur } from '../../core/session.types';
import { AdministrationApi, dateLisible, PageJournal } from './administration.api';

/** Libellés des actions tracées, pour la lecture et le filtre. */
const ACTIONS: Record<string, string> = {
  CONNEXION: 'Connexion',
  DECONNEXION: 'Déconnexion',
  CODE_ENVOYE: 'Code envoyé',
  CODE_REFUSE: 'Code refusé',
  CONNEXION_REFUSEE: 'Connexion refusée',
  COMPTE_BLOQUE: 'Compte bloqué',
  COMPTE_ACTIVE: 'Compte activé',
  MOT_DE_PASSE_CHANGE: 'Mot de passe changé',
  REINITIALISATION_DEMANDEE: 'Lien demandé',
  REINITIALISATION_REFUSEE: 'Lien refusé',
  UTILISATEUR_CREE: 'Compte créé',
  UTILISATEUR_MODIFIE: 'Compte modifié',
  UTILISATEUR_DESACTIVE: 'Compte désactivé',
  LIEN_ENVOYE: 'Lien envoyé',
  ENTITE_CREEE: 'Entité créée',
  ENTITE_MODIFIEE: 'Entité modifiée',
};

@Component({
  selector: 'app-journal',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="entete">
        <div>
          <p class="surtitre">Administration</p>
          <h1 class="titre">Journal</h1>
        </div>
        <div class="entete__actions">
          <a class="bouton" routerLink="/administration/utilisateurs">Utilisateurs</a>
        </div>
      </header>

      <div class="filtres">
        <div class="champ">
          <label class="champ__libelle" for="action">Type d’action</label>
          <div class="champ__zone">
            <select id="action" class="champ__saisie" (change)="filtrer($any($event.target).value)">
              <option value="">Toutes</option>
              @for (a of actions; track a.code) {
                <option [value]="a.code" [selected]="a.code === action()">{{ a.libelle }}</option>
              }
            </select>
          </div>
        </div>
      </div>

      @if (erreur(); as message) {
        <p class="note note--danger" role="alert">{{ message }}</p>
      }
      @if (resultat(); as r) {
        <ul class="evenements">
          @for (ligne of r.lignes; track ligne.id) {
            <li class="evenement" [class.evenement--echec]="ligne.statut === 'ECHEC'">
              <span class="evenement__date">{{ dateLisible(ligne.date) }}</span>
              <span><span class="evenement__action">{{ libelle(ligne.action) }}</span>{{ ligne.message }}</span>
              <span class="evenement__auteur">{{ ligne.auteur ?? '—' }}</span>
            </li>
          } @empty {
            <li class="champ__aide">Aucune action enregistrée.</li>
          }
        </ul>
        <div class="pagination">
          <span class="champ__aide chiffres">{{ r.total }} action{{ r.total > 1 ? 's' : '' }} · page {{ r.page }} sur {{ pages() }}</span>
          <div class="entete__actions">
            <button type="button" class="bouton" [disabled]="r.page <= 1" (click)="aller(r.page - 1)">Plus récentes</button>
            <button type="button" class="bouton" [disabled]="r.page >= pages()" (click)="aller(r.page + 1)">Plus anciennes</button>
          </div>
        </div>
      } @else if (!erreur()) {
        <p class="champ__aide" role="status">Chargement…</p>
      }
    </div>
  `,
  styleUrl: './administration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalComponent implements OnInit {
  private readonly api = inject(AdministrationApi);

  readonly dateLisible = dateLisible;
  readonly actions = Object.entries(ACTIONS).map(([code, libelle]) => ({ code, libelle }));
  readonly resultat = signal<PageJournal | null>(null);
  readonly erreur = signal<string | null>(null);
  readonly action = signal('');
  readonly pages = computed(() => {
    const r = this.resultat();
    return r ? Math.max(1, Math.ceil(r.total / r.parPage)) : 1;
  });

  ngOnInit(): void {
    void this.aller(1);
  }

  libelle(code: string): string {
    return ACTIONS[code] ?? code;
  }

  filtrer(action: string): void {
    this.action.set(action);
    void this.aller(1);
  }

  async aller(page: number): Promise<void> {
    try {
      this.resultat.set(await this.api.journal(page, this.action() || undefined));
      this.erreur.set(null);
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur, 'Le journal n’a pas pu être chargé.'));
    }
  }
}
