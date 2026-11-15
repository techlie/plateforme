import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, scan, startWith, switchMap } from 'rxjs';
import { ecrirePourcent, formaterEuros, lireNombre, lirePourcent } from '../../shared/nombres';
import { SelecteurContratComponent } from './selecteur-contrat.component';
import { SimulateurApi } from './simulateur.api';
import { Catalogue, Contrat, DemandeCalcul, Resultat } from './simulateur.types';

type Preparation = { demande: DemandeCalcul } | { manque: string };

type Etat =
  | { statut: 'attente'; message: string }
  /** Le dernier résultat reste affiché pendant qu'un nouveau calcul est en cours. */
  | { statut: 'calcul'; resultat: Resultat | null }
  | { statut: 'resultat'; resultat: Resultat }
  | { statut: 'erreur'; message: string };

const LIBELLES_MONTANT = {
  COTISATION_ANNUELLE: 'Cotisation annuelle TTC',
  VERSEMENT_ANNUEL: 'Versement annuel',
  VERSEMENT_UNIQUE: 'Montant du versement',
} as const;

/** Au-delà de ce nombre de choix, une liste déroulante remplace les pastilles. */
const MAX_PASTILLES = 6;

@Component({
  selector: 'app-simulateur',
  imports: [SelecteurContratComponent],
  templateUrl: './simulateur.component.html',
  styleUrl: './simulateur.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulateurComponent {
  private readonly api = inject(SimulateurApi);

  readonly catalogue = signal<Catalogue | null>(null);
  readonly chargementImpossible = signal(false);

  readonly contrat = signal<Contrat | null>(null);
  readonly montant = signal('');
  readonly frais = signal('');
  readonly taux = signal('');
  readonly age = signal('');
  readonly partUc = signal('100');
  readonly dejaVerse = signal('');
  readonly option = signal<string | null>(null);
  readonly variante = signal<string | null>(null);
  readonly remuneration = signal<string | null>(null);

  readonly libelleMontant = computed(() => LIBELLES_MONTANT[this.contrat()?.base ?? 'COTISATION_ANNUELLE']);
  readonly optionsEnListe = computed(() => (this.contrat()?.options.length ?? 0) > MAX_PASTILLES);

  /** Rappel mensuel sous un versement annuel. */
  readonly parMois = computed(() => {
    const montant = lireNombre(this.montant());
    return this.contrat()?.base === 'VERSEMENT_ANNUEL' && montant ? formaterEuros(montant / 12) : null;
  });

  readonly plafondMensuel = computed(() => {
    const plafond = this.contrat()?.plafondAnnuel;
    return plafond ? formaterEuros(plafond / 12).replace(',00', '') : null;
  });

  readonly bornesTaux = computed(() => {
    const c = this.contrat();
    return c?.tauxMin !== undefined && c.tauxMax !== undefined
      ? `Entre ${ecrirePourcent(c.tauxMin)} et ${ecrirePourcent(c.tauxMax)} %.`
      : null;
  });

  /** Demande prête à partir, ou ce qu'il reste à renseigner. */
  private readonly preparation = computed<Preparation>(() => {
    const contrat = this.contrat();
    if (!contrat) {
      return { manque: 'Choisissez un contrat pour estimer votre commission.' };
    }
    const montant = lireNombre(this.montant());
    if (montant === null || this.montant().trim() === '') {
      return { manque: `Indiquez ${this.libelleMontant().toLowerCase()}.` };
    }
    const demande: DemandeCalcul = { cleContrat: contrat.cle, montant: Math.round(montant * 100) / 100 };

    if (contrat.saisie === 'LISTE') {
      const option = this.option();
      if (!option) {
        return { manque: 'Choisissez un mode de commission.' };
      }
      demande.option = option;
    }
    if (contrat.saisie === 'FRAIS_LIBRES') {
      const frais = lirePourcent(this.frais());
      if (frais === null || this.frais().trim() === '') {
        return { manque: 'Indiquez les frais sur versements.' };
      }
      const max = contrat.fraisMax ?? 1;
      if (frais > max) {
        return { manque: `Les frais de ce contrat vont de 0 à ${ecrirePourcent(max)} %.` };
      }
      demande.frais = frais;
    }
    if (contrat.demandePartUc) {
      const partUc = lirePourcent(this.partUc());
      if (partUc === null || this.partUc().trim() === '' || partUc > 1) {
        return { manque: 'Indiquez la part investie en unités de compte, entre 0 et 100 %.' };
      }
      demande.partUc = partUc;
    }
    if (contrat.demandeAge) {
      const age = lireNombre(this.age());
      if (age === null || this.age().trim() === '' || !Number.isInteger(age) || age > 120) {
        return { manque: 'Indiquez l’âge de l’assuré.' };
      }
      demande.age = age;
    }
    if (contrat.plafondAnnuel && this.dejaVerse().trim() !== '') {
      const dejaVerse = lireNombre(this.dejaVerse());
      if (dejaVerse === null) {
        return { manque: 'Indiquez en euros les versements déjà en place, ou laissez le champ vide.' };
      }
      demande.versementsExistants = Math.round(dejaVerse * 100) / 100;
    }
    if (contrat.saisie === 'TAUX_MANUEL') {
      const taux = lirePourcent(this.taux());
      if (taux === null || this.taux().trim() === '' || taux > 1) {
        return { manque: 'Indiquez le taux de commission prévu par la compagnie.' };
      }
      if (taux < (contrat.tauxMin ?? 0) || taux > (contrat.tauxMax ?? 1)) {
        return { manque: `Le taux de ce contrat se situe ${(this.bornesTaux() ?? '').toLowerCase()}` };
      }
      demande.taux = taux;
    }
    const variante = this.variante();
    if (variante) {
      demande.variante = variante;
    }
    const remuneration = this.remuneration();
    if (remuneration) {
      demande.remuneration = remuneration;
    }
    return { demande };
  });

  readonly etat = toSignal(
    toObservable(this.preparation).pipe(
      debounceTime(200),
      switchMap((preparation) => {
        if ('manque' in preparation) {
          return of<Etat>({ statut: 'attente', message: preparation.manque });
        }
        return this.api.calculer(preparation.demande).pipe(
          map((resultat): Etat => ({ statut: 'resultat', resultat })),
          startWith<Etat>({ statut: 'calcul', resultat: null }),
          catchError((erreur: HttpErrorResponse) => of<Etat>({ statut: 'erreur', message: SimulateurComponent.expliquer(erreur) })),
        );
      }),
      scan((precedent: Etat, etat: Etat): Etat => {
        if (etat.statut === 'calcul' && 'resultat' in precedent) {
          return { statut: 'calcul', resultat: precedent.resultat };
        }
        return etat;
      }),
    ),
    { initialValue: { statut: 'attente', message: 'Choisissez un contrat pour estimer votre commission.' } as Etat },
  );

  readonly resultat = computed<Resultat | null>(() => {
    const etat = this.etat();
    return 'resultat' in etat ? etat.resultat : null;
  });

  readonly montantAffiche = computed(() => {
    const resultat = this.resultat();
    return resultat ? formaterEuros(resultat.montant) : '—';
  });

  readonly lignes = computed(() => {
    const resultat = this.resultat();
    const contrat = this.contrat();
    if (!resultat || !contrat) {
      return [];
    }
    const lignes: { libelle: string; valeur: string }[] = [];
    if (resultat.baseHorsTaxe) {
      lignes.push({ libelle: 'Cotisation hors taxe estimée', valeur: formaterEuros(resultat.baseCalcul) });
    }
    for (const ligne of resultat.lignes) {
      lignes.push({ libelle: ligne.libelle, valeur: formaterEuros(ligne.montant) });
    }
    if (contrat.saisie === 'SEUIL') {
      const tranche = contrat.variantes.find((v) => v.code === resultat.varianteRetenue);
      if (tranche) {
        lignes.push({ libelle: 'Tranche retenue', valeur: tranche.libelle });
      }
    }
    const remuneration = contrat.remunerations.find((r) => r.code === resultat.remunerationRetenue);
    if (remuneration) {
      lignes.push({ libelle: 'Option de rémunération', valeur: remuneration.libelle });
    }
    return lignes;
  });

  constructor() {
    this.charger();
  }

  charger(): void {
    this.chargementImpossible.set(false);
    this.api.contrats().subscribe({
      next: (catalogue) => this.catalogue.set(catalogue),
      error: () => this.chargementImpossible.set(true),
    });
  }

  /** Change de contrat et remet les choix propres au contrat à leur valeur de départ. Le montant est conservé. */
  choisirContrat(contrat: Contrat): void {
    this.contrat.set(contrat);
    this.option.set(contrat.saisie === 'LISTE' ? (contrat.options[0]?.code ?? null) : null);
    this.remuneration.set(contrat.remunerationParDefaut ?? null);
    this.taux.set('');
    this.dejaVerse.set('');
    this.frais.set(contrat.fraisParDefaut !== undefined ? ecrirePourcent(contrat.fraisParDefaut) : '');
    if (contrat.saisie === 'SEUIL') {
      this.variante.set(null);
    } else {
      const cinqAns = contrat.variantes.find((v) => v.code === 'AVANCE_5_ANS');
      this.variante.set((cinqAns ?? contrat.variantes[0])?.code ?? null);
    }
  }

  saisir(cible: 'montant' | 'frais' | 'taux' | 'age' | 'partUc' | 'dejaVerse', evenement: Event): void {
    this[cible].set((evenement.target as HTMLInputElement).value);
  }

  choisirOption(evenement: Event): void {
    this.option.set((evenement.target as HTMLSelectElement).value);
  }

  private static expliquer(erreur: HttpErrorResponse): string {
    if (erreur.status === 400 && typeof erreur.error?.message === 'string') {
      return erreur.error.message;
    }
    return 'Le calcul est indisponible pour le moment. Réessayez dans un instant.';
  }
}
