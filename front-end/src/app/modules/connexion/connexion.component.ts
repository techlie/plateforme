import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { LogoComponent } from '../../shared/logo/logo.component';
import { messageErreur, ReponseConnexion } from '../../core/session.types';

/** Connexion en deux étapes : mot de passe, puis code reçu par courriel. */
@Component({
  selector: 'app-connexion',
  imports: [RouterLink, LogoComponent],
  templateUrl: './connexion.component.html',
  styleUrl: './acces.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnexionComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** Page demandée avant la connexion, lue dans l'adresse. */
  readonly retour = input<string | undefined>();

  readonly email = signal('');
  readonly motDePasse = signal('');
  readonly code = signal('');
  readonly demande = signal<ReponseConnexion | null>(null);
  readonly erreur = signal<string | null>(null);
  readonly envoi = signal(false);

  private readonly champCode = viewChild<ElementRef<HTMLInputElement>>('champCode');

  saisir(cible: 'email' | 'motDePasse' | 'code', evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    if (cible === 'code') {
      this.code.set(valeur.replace(/\D/g, '').slice(0, 6));
    } else {
      this[cible].set(valeur);
    }
  }

  async envoyerIdentifiants(evenement: Event): Promise<void> {
    evenement.preventDefault();
    if (this.envoi()) return;
    this.erreur.set(null);
    this.envoi.set(true);
    try {
      this.demande.set(await this.session.connexion(this.email().trim(), this.motDePasse()));
      this.motDePasse.set('');
      setTimeout(() => this.champCode()?.nativeElement.focus());
    } catch (erreur) {
      this.erreur.set(messageErreur(erreur, 'Connexion impossible pour le moment. Réessayez.'));
    } finally {
      this.envoi.set(false);
    }
  }

  async envoyerCode(evenement: Event): Promise<void> {
    evenement.preventDefault();
    const demande = this.demande();
    if (!demande || this.envoi()) return;
    this.erreur.set(null);
    this.envoi.set(true);
    try {
      await this.session.validerCode(demande.demande, this.code());
      const retour = this.retour();
      await this.router.navigateByUrl(retour && retour.startsWith('/') && !retour.startsWith('//') ? retour : '/');
    } catch (erreur) {
      const corps = (erreur as { error?: { code?: string } }).error;
      this.erreur.set(messageErreur(erreur, 'Code refusé. Réessayez.'));
      this.code.set('');
      if (corps?.code === 'CODE_PERIME') {
        this.demande.set(null);
      }
    } finally {
      this.envoi.set(false);
    }
  }

  recommencer(): void {
    this.demande.set(null);
    this.code.set('');
    this.erreur.set(null);
  }
}
