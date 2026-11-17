import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { LogoComponent } from '../../shared/logo/logo.component';
import { messageErreur } from '../../core/session.types';

@Component({
  selector: 'app-mot-de-passe-oublie',
  imports: [RouterLink, LogoComponent],
  template: `
    <div class="acces">
      <app-logo class="acces__marque" />
      <div>
        <h1 class="acces__titre">Mot de passe oublié</h1>
        <p class="acces__texte">Indiquez votre adresse : si elle correspond à un compte actif, vous recevrez un lien pour choisir un nouveau mot de passe.</p>
      </div>

      @if (confirmation(); as message) {
        <p class="note note--succes" role="status">{{ message }}</p>
      } @else {
        <form class="acces__formulaire" (submit)="envoyer($event)" novalidate>
          <div class="champ">
            <label class="champ__libelle" for="email">Adresse électronique</label>
            <div class="champ__zone">
              <input id="email" class="champ__saisie" type="email" autocomplete="username" required
                [value]="email()" (input)="email.set($any($event.target).value)" />
            </div>
          </div>
          @if (erreur(); as message) {
            <p class="note note--danger" role="alert">{{ message }}</p>
          }
          <button class="bouton bouton--principal" type="submit" [disabled]="envoi() || !email()">Recevoir le lien</button>
        </form>
      }

      <div class="acces__pied">
        <a class="lien-texte" routerLink="/connexion">Retour à la connexion</a>
      </div>
    </div>
  `,
  styleUrl: './acces.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotDePasseOublieComponent {
  private readonly session = inject(SessionService);

  readonly email = signal('');
  readonly envoi = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly confirmation = signal<string | null>(null);

  async envoyer(evenement: Event): Promise<void> {
    evenement.preventDefault();
    this.erreur.set(null);
    this.envoi.set(true);
    try {
      this.confirmation.set((await this.session.motDePasseOublie(this.email().trim())).message);
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur));
    } finally {
      this.envoi.set(false);
    }
  }
}
