import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { messageErreur } from '../../core/session.types';
import { EnveloppesApi } from './enveloppes.api';
import { Compagnie, Enveloppe, Parametres } from './enveloppes.types';
import { aujourdhuiParis, depuisMontant, depuisTaux, versMontant, versTaux } from './formats';

/**
 * Création et paramétrage d'une enveloppe. En préparation, le back-office et l'administrateur
 * paramètrent librement ; une enveloppe ouverte ne se modifie que par un administrateur, avec motif.
 */
@Component({
  selector: 'app-edition-enveloppe',
  imports: [RouterLink, FormsModule],
  templateUrl: './edition-enveloppe.component.html',
  styleUrl: './enveloppes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionEnveloppeComponent implements OnInit {
  private readonly api = inject(EnveloppesApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** Absent pour une création. */
  readonly id = input<string | undefined>();

  readonly administrateur = computed(() => ['SUPER_ADMINISTRATEUR', 'ADMINISTRATEUR'].includes(this.session.utilisateur()?.profil ?? ''));
  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly envoi = signal(false);
  readonly compagnies = signal<Compagnie[]>([]);
  readonly parametres = signal<Parametres | null>(null);
  readonly existante = signal<Enveloppe | null>(null);

  readonly compagnieId = signal('');
  readonly nomProduit = signal('');
  readonly isin = signal('');
  readonly montantInitial = signal('');
  readonly dateOuverture = signal(aujourdhuiParis());
  readonly dateLimiteInterne = signal('');
  readonly dateFinCommercialisation = signal('');
  readonly dateClotureProduit = signal('');
  readonly tauxCommission = signal('');
  readonly tauxClientsConfies = signal('');
  readonly rendement = signal('');
  readonly seuilConcentration = signal('');
  readonly montantMinimum = signal('');
  readonly controlePatrimoine = signal(false);
  readonly gammesExclues = signal<string[]>([]);
  readonly motif = signal('');

  readonly ouverte = computed(() => !!this.existante() && this.existante()!.statut !== 'EN_PREPARATION');
  readonly compagnie = computed(() => this.compagnies().find((c) => c.id === this.compagnieId()) ?? null);
  readonly gammes = computed(() => (this.compagnie()?.gammes ?? []).filter((g) => g.actif));
  readonly lectureSeule = computed(() => this.ouverte() && !this.administrateur());

  async ngOnInit(): Promise<void> {
    try {
      const [compagnies, parametres] = await Promise.all([this.api.compagnies(), this.api.parametres()]);
      this.compagnies.set(compagnies.filter((c) => c.actif));
      this.parametres.set(parametres);
      if (this.id()) {
        const e = await this.api.enveloppe(this.id()!);
        this.existante.set(e);
        this.compagnieId.set(e.compagnie.id);
        if (!this.compagnies().some((c) => c.id === e.compagnie.id)) this.compagnies.update((l) => [...l, compagnies.find((c) => c.id === e.compagnie.id)!].filter(Boolean));
        this.nomProduit.set(e.nomProduit);
        this.isin.set(e.isin ?? '');
        this.montantInitial.set(depuisMontant(e.montantInitial));
        this.dateOuverture.set(e.dateOuverture);
        this.dateLimiteInterne.set(e.dateLimiteInterne);
        this.dateFinCommercialisation.set(e.dateFinCommercialisation);
        this.dateClotureProduit.set(e.dateClotureProduit);
        this.tauxCommission.set(depuisTaux(e.tauxCommission));
        this.tauxClientsConfies.set(depuisTaux(e.tauxClientsConfies));
        this.rendement.set(e.rendement ?? '');
        this.seuilConcentration.set(depuisTaux(e.seuilConcentration));
        this.montantMinimum.set(depuisMontant(e.montantMinimum));
        this.controlePatrimoine.set(e.controlePatrimoine);
        this.gammesExclues.set(e.gammesExclues.map((g) => g.id));
      } else {
        this.tauxClientsConfies.set(depuisTaux(parametres.tauxClientsConfiesDefaut));
        this.seuilConcentration.set(depuisTaux(parametres.seuilConcentrationDefaut));
      }
    } catch (e) {
      this.erreur.set(messageErreur(e, 'Le formulaire n’a pas pu être préparé.'));
    } finally {
      this.chargement.set(false);
    }
  }

  basculerGamme(id: string, coche: boolean): void {
    this.gammesExclues.update((l) => (coche ? [...new Set([...l, id])] : l.filter((x) => x !== id)));
  }

  async enregistrer(): Promise<void> {
    const montantInitial = versMontant(this.montantInitial());
    const montantMinimum = versMontant(this.montantMinimum());
    const tauxCommission = versTaux(this.tauxCommission());
    const tauxClientsConfies = versTaux(this.tauxClientsConfies());
    const seuil = this.seuilConcentration().trim() ? versTaux(this.seuilConcentration()) : '';
    if (!this.compagnieId() || !this.nomProduit().trim()) return this.erreur.set('Choisissez la compagnie et nommez le produit.');
    if (!montantInitial || !montantMinimum || !tauxCommission || !tauxClientsConfies || seuil === null) return this.erreur.set('Un montant ou un taux n’est pas lisible.');
    if (!this.dateLimiteInterne() || !this.dateFinCommercialisation() || !this.dateClotureProduit()) return this.erreur.set('Les quatre dates sont obligatoires.');
    const corps: Record<string, unknown> = {
      nomProduit: this.nomProduit().trim(),
      isin: this.isin().trim(),
      montantInitial,
      dateOuverture: this.dateOuverture(),
      dateLimiteInterne: this.dateLimiteInterne(),
      dateFinCommercialisation: this.dateFinCommercialisation(),
      dateClotureProduit: this.dateClotureProduit(),
      tauxCommission,
      tauxClientsConfies,
      rendement: this.rendement().trim(),
      seuilConcentration: seuil,
      montantMinimum,
      controlePatrimoine: this.controlePatrimoine(),
      gammesExclues: this.gammesExclues(),
    };
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      let e: Enveloppe;
      if (this.existante()) {
        e = await this.api.modifierEnveloppe(this.existante()!.id, { ...corps, motif: this.ouverte() ? this.motif().trim() : undefined });
      } else {
        e = await this.api.creerEnveloppe({ ...corps, compagnieId: this.compagnieId(), isin: this.isin().trim() || undefined, rendement: this.rendement().trim() || undefined, seuilConcentration: seuil || undefined });
      }
      await this.router.navigate(['/enveloppes', e.id]);
    } catch (err) {
      this.erreur.set(messageErreur(err));
    } finally {
      this.envoi.set(false);
    }
  }
}
