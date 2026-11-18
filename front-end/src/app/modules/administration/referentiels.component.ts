import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { messageErreur } from '../../core/session.types';
import { EnveloppesApi } from '../enveloppes/enveloppes.api';
import { Apporteur, CodeApporteur, Compagnie, Fonds } from '../enveloppes/enveloppes.types';
import { AdministrationApi, Entite, FicheUtilisateur } from './administration.api';

type Onglet = 'compagnies' | 'apporteurs' | 'codes' | 'fonds';
type ResultatImport = Awaited<ReturnType<EnveloppesApi['importerFonds']>>;

const ROLES = { MANDATAIRE: 'Mandataire', ASSOCIE: 'Associé', SALARIE: 'Salarié' } as const;
const NATURES = { PROPRE: 'Code propre', PARTENARIAT: 'Code de partenariat', ENTITE: 'Code de l’entité' } as const;

/**
 * Référentiels communs : compagnies et gammes, apporteurs, codes apporteur, fonds. Saisis une
 * fois, jamais recopiés ; réservés aux administrateurs.
 */
@Component({
  selector: 'app-referentiels',
  imports: [FormsModule],
  templateUrl: './referentiels.component.html',
  styleUrls: ['./administration.css', '../enveloppes/enveloppes.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferentielsComponent implements OnInit {
  private readonly api = inject(EnveloppesApi);
  private readonly admin = inject(AdministrationApi);

  readonly roles = ROLES;
  readonly natures = NATURES;
  readonly onglet = signal<Onglet>('compagnies');
  readonly erreur = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly envoi = signal(false);

  readonly compagnies = signal<Compagnie[]>([]);
  readonly apporteurs = signal<Apporteur[]>([]);
  readonly codes = signal<CodeApporteur[]>([]);
  readonly entites = signal<Entite[]>([]);
  readonly comptes = signal<FicheUtilisateur[]>([]);
  readonly fonds = signal<Fonds[]>([]);

  // Compagnie
  readonly cNom = signal('');
  readonly cFormat = signal('');
  readonly cExemple = signal('');
  readonly nouvellesGammes = signal<Partial<Record<string, string>>>({});
  // Apporteur
  readonly aNom = signal('');
  readonly aPrenom = signal('');
  readonly aEmail = signal('');
  readonly aRole = signal<keyof typeof ROLES>('MANDATAIRE');
  readonly aEntite = signal('');
  readonly aCompte = signal('');
  readonly aHabilite = signal(false);
  // Code
  readonly kCompagnie = signal('');
  readonly kCode = signal('');
  readonly kNature = signal<keyof typeof NATURES>('PROPRE');
  readonly kApporteurs = signal<string[]>([]);
  readonly kDebut = signal('');
  readonly kFin = signal('');
  // Fonds
  readonly fCompagnie = signal('');
  readonly fContenu = signal('');
  readonly fNomFichier = signal('');
  readonly apercu = signal<ResultatImport | null>(null);

  readonly comptesLibres = computed(() => {
    const pris = new Set(this.apporteurs().map((a) => a.compte?.id).filter(Boolean));
    return this.comptes().filter((c) => c.actif && !pris.has(c.id));
  });
  readonly fondsOuverts = computed(() => this.fonds().filter((f) => f.ouvert).length);

  async ngOnInit(): Promise<void> {
    await this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const [compagnies, apporteurs, codes, entites, comptes] = await Promise.all([
        this.api.compagnies(),
        this.api.apporteurs(),
        this.api.codes(),
        this.admin.entites(),
        this.admin.utilisateurs(),
      ]);
      this.compagnies.set(compagnies);
      this.apporteurs.set(apporteurs);
      this.codes.set(codes);
      this.entites.set(entites.filter((e) => e.actif));
      this.comptes.set(comptes);
    } catch (e) {
      this.erreur.set(messageErreur(e));
    }
  }

  private async executer(travail: () => Promise<unknown>, confirmation: string): Promise<boolean> {
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    try {
      await travail();
      this.message.set(confirmation);
      await this.charger();
      return true;
    } catch (e) {
      this.erreur.set(messageErreur(e));
      return false;
    } finally {
      this.envoi.set(false);
    }
  }

  async creerCompagnie(): Promise<void> {
    if (
      await this.executer(
        () => this.api.creerCompagnie({ nom: this.cNom(), formatNumeroContrat: this.cFormat() || undefined, exempleNumeroContrat: this.cExemple() || undefined }),
        'Compagnie créée.',
      )
    ) {
      this.cNom.set('');
      this.cFormat.set('');
      this.cExemple.set('');
    }
  }

  modifierFormat(c: Compagnie, format: string, exemple: string): Promise<boolean> {
    return this.executer(() => this.api.modifierCompagnie(c.id, { formatNumeroContrat: format, exempleNumeroContrat: exemple }), `Modèle de numéro de ${c.nom} enregistré.`);
  }

  basculerCompagnie(c: Compagnie): Promise<boolean> {
    return this.executer(() => this.api.modifierCompagnie(c.id, { actif: !c.actif }), `${c.nom} ${c.actif ? 'désactivée' : 'réactivée'}.`);
  }

  saisirGamme(compagnieId: string, nom: string): void {
    this.nouvellesGammes.update((g) => ({ ...g, [compagnieId]: nom }));
  }

  async ajouterGamme(c: Compagnie): Promise<void> {
    const nom = this.nouvellesGammes()[c.id]?.trim();
    if (!nom) return;
    if (await this.executer(() => this.api.ajouterGamme(c.id, nom), `Gamme ajoutée chez ${c.nom}.`)) this.saisirGamme(c.id, '');
  }

  basculerGamme(id: string, actif: boolean): Promise<boolean> {
    return this.executer(() => this.api.modifierGamme(id, { actif }), 'Gamme modifiée.');
  }

  async creerApporteur(): Promise<void> {
    const ok = await this.executer(
      () =>
        this.api.creerApporteur({
          nom: this.aNom(),
          prenom: this.aPrenom(),
          email: this.aEmail().trim() || undefined,
          role: this.aRole(),
          entiteId: this.aEntite() || undefined,
          userId: this.aCompte() || undefined,
          habiliteReservationGlobale: this.aHabilite(),
        }),
      'Apporteur créé.',
    );
    if (ok) {
      this.aNom.set('');
      this.aPrenom.set('');
      this.aEmail.set('');
      this.aCompte.set('');
      this.aHabilite.set(false);
    }
  }

  /** Pré-remplit l'apporteur depuis un compte existant. */
  choisirCompte(id: string): void {
    this.aCompte.set(id);
    const c = this.comptes().find((x) => x.id === id);
    if (c) {
      this.aNom.set(c.nom);
      this.aPrenom.set(c.prenom);
      this.aEntite.set(c.entite?.id ?? '');
    }
  }

  modifierApporteur(a: Apporteur, champs: Record<string, unknown>, confirmation: string): Promise<boolean> {
    return this.executer(() => this.api.modifierApporteur(a.id, champs), confirmation);
  }

  rattacherCompte(a: Apporteur, userId: string): Promise<boolean> {
    return this.modifierApporteur(a, { userId }, userId ? 'Compte rattaché.' : 'Compte détaché.');
  }

  basculerApporteurCode(id: string, coche: boolean): void {
    this.kApporteurs.update((l) => (coche ? [...new Set([...l, id])] : l.filter((x) => x !== id)));
  }

  async creerCode(): Promise<void> {
    const ok = await this.executer(
      () =>
        this.api.creerCode({
          compagnieId: this.kCompagnie(),
          code: this.kCode(),
          nature: this.kNature(),
          apporteurIds: this.kApporteurs(),
          dateDebut: this.kDebut() || undefined,
          dateFin: this.kFin() || undefined,
        }),
      'Code apporteur créé.',
    );
    if (ok) {
      this.kCode.set('');
      this.kApporteurs.set([]);
    }
  }

  basculerCode(k: CodeApporteur): Promise<boolean> {
    return this.executer(() => this.api.modifierCode(k.id, { actif: !k.actif }), `Code ${k.code} ${k.actif ? 'désactivé' : 'réactivé'}.`);
  }

  async choisirCompagnieFonds(id: string): Promise<void> {
    this.fCompagnie.set(id);
    this.apercu.set(null);
    this.fonds.set(id ? await this.api.fonds(id) : []);
  }

  async lireFichier(evenement: Event): Promise<void> {
    const fichier = (evenement.target as HTMLInputElement).files?.[0];
    this.apercu.set(null);
    if (!fichier) return;
    this.fNomFichier.set(fichier.name);
    this.fContenu.set(await fichier.text());
    await this.importer(false);
  }

  async importer(appliquer: boolean): Promise<void> {
    if (!this.fCompagnie() || !this.fContenu()) return;
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      const r = await this.api.importerFonds({ compagnieId: this.fCompagnie(), contenu: this.fContenu(), appliquer });
      this.apercu.set(r);
      if (appliquer) {
        this.message.set('Liste des fonds importée.');
        this.fonds.set(await this.api.fonds(this.fCompagnie()));
      }
    } catch (e) {
      this.erreur.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  nomDe = (x: { nom: string }) => x.nom;

  codesDe(a: Apporteur): string {
    return a.codes.map((k) => `${this.compagnies().find((c) => c.id === k.compagnieId)?.nom ?? ''} ${k.code}`.trim()).join(', ');
  }
}
