import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { normaliser } from '../../shared/nombres';
import { Contrat } from './simulateur.types';

interface Groupe {
  compagnie: string;
  contrats: { contrat: Contrat; rang: number }[];
}

/** Recherche d'un contrat par compagnie, famille ou nom, au clavier comme à la souris. */
@Component({
  selector: 'app-selecteur-contrat',
  templateUrl: './selecteur-contrat.component.html',
  styleUrl: './selecteur-contrat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'surPointeurExterieur($event)' },
})
export class SelecteurContratComponent {
  private readonly hote: ElementRef<HTMLElement> = inject(ElementRef);

  readonly contrats = input.required<Contrat[]>();
  readonly selection = input<Contrat | null>(null);
  readonly choisi = output<Contrat>();

  readonly ouvert = signal(false);
  readonly recherche = signal('');
  readonly rangActif = signal(0);

  /** Texte affiché dans le champ : la recherche en cours, sinon le contrat retenu. */
  readonly texte = computed(() => {
    if (this.ouvert()) {
      return this.recherche();
    }
    const contrat = this.selection();
    return contrat ? `${contrat.compagnie} · ${contrat.libelle}` : '';
  });

  private readonly trouves = computed(() => {
    const mots = normaliser(this.recherche()).split(/\s+/).filter(Boolean);
    return this.contrats().filter((c) => {
      const cible = normaliser(`${c.compagnie} ${c.famille} ${c.libelle}`);
      return mots.every((mot) => cible.includes(mot));
    });
  });

  readonly nombre = computed(() => this.trouves().length);

  readonly groupes = computed<Groupe[]>(() => {
    const groupes: Groupe[] = [];
    this.trouves().forEach((contrat, rang) => {
      const dernier = groupes[groupes.length - 1];
      if (dernier && dernier.compagnie === contrat.compagnie) {
        dernier.contrats.push({ contrat, rang });
      } else {
        groupes.push({ compagnie: contrat.compagnie, contrats: [{ contrat, rang }] });
      }
    });
    return groupes;
  });

  /**
   * Ouvre la liste et vide le champ pour laisser place à la recherche.
   * Le champ est vidé tout de suite, sans attendre le prochain rafraîchissement de l'écran :
   * une frappe rapide ne doit pas s'ajouter au nom du contrat déjà retenu.
   */
  ouvrir(champ?: HTMLInputElement): void {
    if (!this.ouvert()) {
      if (champ) {
        champ.value = '';
      }
      this.recherche.set('');
      this.rangActif.set(0);
      this.ouvert.set(true);
    }
  }

  fermer(): void {
    this.ouvert.set(false);
  }

  surSaisie(evenement: Event): void {
    this.ouvert.set(true);
    this.recherche.set((evenement.target as HTMLInputElement).value);
    this.rangActif.set(0);
  }

  surTouche(evenement: KeyboardEvent): void {
    const dernier = this.nombre() - 1;
    if (evenement.key === 'ArrowDown') {
      evenement.preventDefault();
      this.ouvrir(evenement.target as HTMLInputElement);
      this.activer(Math.min(this.rangActif() + 1, dernier));
    } else if (evenement.key === 'ArrowUp') {
      evenement.preventDefault();
      this.activer(Math.max(this.rangActif() - 1, 0));
    } else if (evenement.key === 'Enter' && this.ouvert()) {
      evenement.preventDefault();
      const contrat = this.trouves()[this.rangActif()];
      if (contrat) {
        this.retenir(contrat);
      }
    } else if (evenement.key === 'Escape' && this.ouvert()) {
      evenement.preventDefault();
      this.fermer();
    } else if (evenement.key === 'Tab') {
      this.fermer();
    }
  }

  retenir(contrat: Contrat): void {
    this.choisi.emit(contrat);
    this.fermer();
  }

  surPointeurExterieur(evenement: Event): void {
    if (this.ouvert() && !this.hote.nativeElement.contains(evenement.target as Node)) {
      this.fermer();
    }
  }

  private activer(rang: number): void {
    this.rangActif.set(rang);
    queueMicrotask(() => {
      this.hote.nativeElement.querySelector(`#contrat-${rang}`)?.scrollIntoView({ block: 'nearest' });
    });
  }
}
