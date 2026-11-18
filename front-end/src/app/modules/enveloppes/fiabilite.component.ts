import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { messageErreur } from '../../core/session.types';
import { EnveloppesApi } from './enveloppes.api';
import { Fiabilite } from './enveloppes.types';
import { euros, pourcent } from './formats';

/**
 * Fiabilité des mandataires, pour le back-office et l'administrateur. Ces indicateurs éclairent la
 * décision de restreindre un mandataire ; ils ne la déclenchent jamais seuls.
 */
@Component({
  selector: 'app-fiabilite',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="entete">
        <div>
          <p class="surtitre"><a routerLink="/enveloppes">Enveloppes</a></p>
          <h1 class="titre">Fiabilité des mandataires</h1>
          <p class="sous-titre">Depuis la mise en service · taux de réalisation sur 12 mois, chaque ligne plafonnée à 100 %. Les annulations non imputables au mandataire n’y entrent pas.</p>
        </div>
      </header>
      <p class="discret">Décision du 18 novembre : chaque annulation imputable compte 1 ; elle compte 2 quand elle tombe dans les derniers jours avant la date limite interne sur une réservation saisie longtemps avant. Le poids total est la somme.</p>
      @if (erreur()) {
        <p class="note note--danger" role="alert">{{ erreur() }}</p>
      } @else if (lignes().length === 0) {
        <p class="vide">Aucune réservation pour l’instant.</p>
      } @else {
        <ul class="lignes">
          <li class="ligne ligne--entete" aria-hidden="true" style="grid-template-columns: minmax(0,1.4fr) repeat(6, minmax(0,1fr))">
            <span>Mandataire</span><span class="droite">Réalisation</span><span class="droite">Annulations</span><span class="droite">Tardives</span><span class="droite">Poids</span><span class="droite">Non honorées</span><span class="droite">Délai moyen</span>
          </li>
          @for (f of lignes(); track f.apporteur.id) {
            <li class="ligne" style="grid-template-columns: minmax(0,1.4fr) repeat(6, minmax(0,1fr))">
              <span><span class="ligne__principal">{{ f.apporteur.prenom }} {{ f.apporteur.nom }}</span><br /><span class="ligne__second">{{ f.apporteur.entite?.nom ?? '' }}{{ f.apporteur.restreint ? ' · restreint' : '' }}</span></span>
              <span class="droite"><span class="etiquette-mobile">Réalisation</span>{{ f.tauxRealisation === null ? '—' : pourcent(f.tauxRealisation) }} <span class="ligne__second">({{ f.lignesComptees }})</span></span>
              <span class="droite"><span class="etiquette-mobile">Annulations dans les délais</span>{{ f.annulationsDansLesDelais.nombre }} · {{ euros(f.annulationsDansLesDelais.montant) }}</span>
              <span class="droite"><span class="etiquette-mobile">Tardives</span>{{ f.annulationsTardives.nombre }} · {{ euros(f.annulationsTardives.montant) }}</span>
              <span class="droite"><span class="etiquette-mobile">Poids des annulations</span>{{ f.poidsAnnulations }}</span>
              <span class="droite"><span class="etiquette-mobile">Non honorées</span>{{ f.nonHonorees.nombre }} · {{ f.prolongations }} prolong.</span>
              <span class="droite"><span class="etiquette-mobile">Délai moyen</span>{{ f.delaiMoyenJours === null ? '—' : f.delaiMoyenJours + ' j' }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styleUrl: './enveloppes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiabiliteComponent implements OnInit {
  private readonly api = inject(EnveloppesApi);
  readonly euros = euros;
  readonly pourcent = pourcent;
  readonly lignes = signal<Fiabilite[]>([]);
  readonly erreur = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.lignes.set(await this.api.fiabilite());
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }
}
