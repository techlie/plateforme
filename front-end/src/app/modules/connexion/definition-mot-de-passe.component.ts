import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { LogoComponent } from '../../shared/logo/logo.component';
import { messageErreur } from '../../core/session.types';

const LONGUEUR_MINIMALE = 12;

/** Activation du compte ou nouveau mot de passe, depuis le lien reçu par courriel. */
@Component({
  selector: 'app-definition-mot-de-passe',
  imports: [RouterLink, LogoComponent],
  template: `
    <div class="acces">
      <app-logo class="acces__marque" />

      @switch (etat()) {
        @case ('verification') {
          <p class="acces__texte" role="status">Vérification du lien…</p>
        }
        @case ('perime') {
          <div>
            <h1 class="acces__titre">Lien expiré</h1>
            <p class="acces__texte">{{ erreur() }}</p>
          </div>
          <div class="acces__pied">
            <a class="lien-texte" routerLink="/mot-de-passe-oublie">Recevoir un nouveau lien</a>
          </div>
        }
        @case ('termine') {
          <div>
            <h1 class="acces__titre">C’est fait</h1>
            <p class="acces__texte">Votre mot de passe est enregistré. Connectez-vous : un code vous sera envoyé par courriel.</p>
          </div>
          <a class="bouton bouton--principal" routerLink="/connexion">Se connecter</a>
        }
        @default {
          <div>
            <h1 class="acces__titre">{{ activation() ? 'Bienvenue ' + prenom() : 'Nouveau mot de passe' }}</h1>
            <p class="acces__texte">
              {{ activation() ? 'Choisissez le mot de passe de votre accès à la plateforme.' : 'Choisissez votre nouveau mot de passe.' }}
              Douze caractères au moins : une courte phrase facile à retenir convient très bien.
            </p>
          </div>
          <form class="acces__formulaire" (submit)="envoyer($event)" novalidate>
            <div class="champ">
              <label class="champ__libelle" for="nouveau">Mot de passe</label>
              <div class="champ__zone">
                <input id="nouveau" class="champ__saisie" type="password" autocomplete="new-password" required
                  [value]="motDePasse()" (input)="motDePasse.set($any($event.target).value)" />
              </div>
              <span class="champ__aide">{{ motDePasse().length }} caractère{{ motDePasse().length > 1 ? 's' : '' }} sur 12 au moins.</span>
            </div>
            <div class="champ">
              <label class="champ__libelle" for="confirmation">Le même, une seconde fois</label>
              <div class="champ__zone">
                <input id="confirmation" class="champ__saisie" type="password" autocomplete="new-password" required
                  [value]="confirmation()" (input)="confirmation.set($any($event.target).value)" />
              </div>
            </div>
            @if (erreur(); as message) {
              <p class="note note--danger" role="alert">{{ message }}</p>
            }
            <button class="bouton bouton--principal" type="submit" [disabled]="envoi() || !valide()">Enregistrer</button>
          </form>
        }
      }
    </div>
  `,
  styleUrl: './acces.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DefinitionMotDePasseComponent implements OnInit {
  private readonly session = inject(SessionService);

  /** Jeton lu dans l'adresse du lien reçu. */
  readonly jeton = input<string | undefined>();

  readonly etat = signal<'verification' | 'saisie' | 'perime' | 'termine'>('verification');
  readonly activation = signal(false);
  readonly prenom = signal('');
  readonly motDePasse = signal('');
  readonly confirmation = signal('');
  readonly erreur = signal<string | null>(null);
  readonly envoi = signal(false);
  readonly valide = computed(() => this.motDePasse().length >= LONGUEUR_MINIMALE && this.motDePasse() === this.confirmation());

  async ngOnInit(): Promise<void> {
    const jeton = this.jeton();
    if (!jeton) {
      this.erreur.set('Ce lien est incomplet. Demandez-en un nouveau.');
      this.etat.set('perime');
      return;
    }
    try {
      const lien = await this.session.verifierLien(jeton);
      this.activation.set(lien.motif === 'ACTIVATION');
      this.prenom.set(lien.prenom);
      this.etat.set('saisie');
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur, 'Ce lien a expiré ou a déjà servi.'));
      this.etat.set('perime');
    }
  }

  async envoyer(evenement: Event): Promise<void> {
    evenement.preventDefault();
    if (this.motDePasse() !== this.confirmation()) {
      this.erreur.set('Les deux saisies ne sont pas identiques.');
      return;
    }
    this.erreur.set(null);
    this.envoi.set(true);
    try {
      await this.session.definirMotDePasse(this.jeton()!, this.motDePasse());
      this.motDePasse.set('');
      this.confirmation.set('');
      this.etat.set('termine');
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur));
    } finally {
      this.envoi.set(false);
    }
  }
}
