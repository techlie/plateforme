import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { messageErreur } from '../../core/session.types';
import { EnveloppesApi } from './enveloppes.api';
import { CategorieMotif, Motif, Parametres } from './enveloppes.types';
import { dateHeure, depuisTaux, pourcent, versTaux } from './formats';

const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const CATEGORIES: { cle: CategorieMotif; libelle: string }[] = [
  { cle: 'REFUS', libelle: 'Refus' },
  { cle: 'RENVOI', libelle: 'Renvoi pour correction' },
  { cle: 'ANNULATION', libelle: 'Annulation' },
  { cle: 'ECART', libelle: 'Écart réservé / validé' },
];

/** Paramètres du module et listes de motifs, réglés par l'administrateur. */
@Component({
  selector: 'app-parametres-enveloppes',
  imports: [RouterLink, FormsModule],
  templateUrl: './parametres.component.html',
  styleUrl: './enveloppes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametresEnveloppesComponent implements OnInit {
  private readonly api = inject(EnveloppesApi);
  readonly jours = JOURS;
  readonly categories = CATEGORIES;
  readonly pourcent = pourcent;
  readonly dateHeure = dateHeure;

  readonly parametres = signal<Parametres | null>(null);
  readonly motifs = signal<Motif[]>([]);
  readonly erreur = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly envoi = signal(false);

  readonly delai = signal('');
  readonly rappel = signal('');
  readonly seuilEcart = signal('');
  readonly tardif = signal('');
  readonly tauxConfies = signal('');
  readonly concentration = signal('');
  readonly jour = signal(4);
  readonly heure = signal('09:01');

  readonly nouveauCategorie = signal<CategorieMotif>('REFUS');
  readonly nouveauLibelle = signal('');
  readonly nouveauImputable = signal(false);
  readonly nouveauCommentaire = signal(false);

  async ngOnInit(): Promise<void> {
    await this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const [p, motifs] = await Promise.all([this.api.parametres(), this.api.motifs()]);
      this.remplir(p);
      this.motifs.set(motifs);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  private remplir(p: Parametres): void {
    this.parametres.set(p);
    this.delai.set(p.delaiHonorerJours?.toString() ?? '');
    this.rappel.set(p.rappelAvantEcheanceJours?.toString() ?? '');
    this.seuilEcart.set(depuisTaux(p.seuilEcart));
    this.tardif.set(String(p.delaiAnnulationTardiveJours));
    this.tauxConfies.set(depuisTaux(p.tauxClientsConfiesDefaut));
    this.concentration.set(depuisTaux(p.seuilConcentrationDefaut));
    this.jour.set(p.emailingJour);
    this.heure.set(p.emailingHeure);
  }

  motifsDe(c: CategorieMotif): Motif[] {
    return this.motifs().filter((m) => m.categorie === c);
  }

  async enregistrer(): Promise<void> {
    const entier = (v: string) => (v.trim() === '' ? null : Number.parseInt(v, 10));
    const seuilEcart = versTaux(this.seuilEcart());
    const tauxConfies = versTaux(this.tauxConfies());
    const concentration = versTaux(this.concentration());
    if (!seuilEcart || !tauxConfies || !concentration) return this.erreur.set('Un taux n’est pas lisible.');
    const corps: Record<string, unknown> = {
      delaiHonorerJours: entier(this.delai()),
      rappelAvantEcheanceJours: entier(this.rappel()),
      seuilEcart,
      delaiAnnulationTardiveJours: entier(this.tardif()) ?? 15,
      seuilConcentrationDefaut: concentration,
      emailingJour: this.jour(),
      emailingHeure: this.heure(),
    };
    if (tauxConfies !== this.parametres()?.tauxClientsConfiesDefaut) corps['tauxClientsConfiesDefaut'] = tauxConfies;
    await this.executer(async () => this.remplir(await this.api.modifierParametres(corps)), 'Paramètres enregistrés.');
  }

  validerEmailing(): Promise<void> {
    return this.executer(async () => this.remplir(await this.api.validerEmailing()), 'Modèle du mail hebdomadaire validé : les envois partent seuls.');
  }

  async ajouterMotif(): Promise<void> {
    if (this.nouveauLibelle().trim().length < 2) return this.erreur.set('Libellé trop court.');
    await this.executer(async () => {
      await this.api.creerMotif({
        categorie: this.nouveauCategorie(),
        libelle: this.nouveauLibelle().trim(),
        imputable: this.nouveauCategorie() === 'ANNULATION' ? this.nouveauImputable() : undefined,
        commentaireObligatoire: this.nouveauCommentaire(),
      });
      this.nouveauLibelle.set('');
      this.motifs.set(await this.api.motifs());
    }, 'Motif ajouté.');
  }

  basculerMotif(m: Motif, champ: 'actif' | 'imputable', valeur: boolean): Promise<void> {
    return this.executer(async () => {
      await this.api.modifierMotif(m.id, { [champ]: valeur });
      this.motifs.set(await this.api.motifs());
    }, 'Motif modifié.');
  }

  private async executer(travail: () => Promise<void>, confirmation: string): Promise<void> {
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      await travail();
      this.message.set(confirmation);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }
}
