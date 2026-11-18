import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { messageErreur } from '../../core/session.types';
import { codeErreur, controlesRefuses, EnveloppesApi } from './enveloppes.api';
import { Apercu, Apporteur, ClientConfie, CodeDerogation, Constat, Enveloppe, Fonds, ModeArbitrage, TypeClient, TypeOperation } from './enveloppes.types';
import { aujourdhuiParis, compteARebours, dateCourte, euros, eurosRonds, pourcent, versMontant, versTaux } from './formats';
import { rechercherFonds } from './recherche-fonds';

interface LigneSaisie {
  cle: number;
  fondsId: string | null;
  nom: string;
  isin: string;
  montant: string;
  ferme: boolean;
}

const LIBELLES_DEROGATIONS: Record<CodeDerogation, string> = {
  FORMAT_CONTRAT: 'Numéro hors format accepté (contrat ancien ou atypique)',
  DEPASSEMENT: 'Dépassement de l’enveloppe accordé',
  DATE_LIMITE: 'Saisie après la date limite interne accordée',
};

/**
 * Nouvelle réservation. Avant l'envoi, la plateforme affiche le net investi, la commission estimée,
 * l'enveloppe restante après la demande et chaque contrôle de la section 6 du cahier des charges.
 */
@Component({
  selector: 'app-reserver',
  imports: [RouterLink, FormsModule],
  templateUrl: './reserver.component.html',
  styleUrl: './enveloppes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReserverComponent implements OnInit {
  private readonly api = inject(EnveloppesApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  /** Client confié dont le mandataire signale l'accord. */
  readonly confie = input<string | undefined>();

  readonly euros = euros;
  readonly eurosRonds = eurosRonds;
  readonly pourcent = pourcent;
  readonly dateCourte = dateCourte;
  readonly compteARebours = compteARebours;
  readonly libellesDerogations = LIBELLES_DEROGATIONS;

  readonly gestion = computed(() => ['SUPER_ADMINISTRATEUR', 'ADMINISTRATEUR', 'BACK_OFFICE'].includes(this.session.utilisateur()?.profil ?? ''));
  readonly administrateur = computed(() => ['SUPER_ADMINISTRATEUR', 'ADMINISTRATEUR'].includes(this.session.utilisateur()?.profil ?? ''));

  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly enveloppe = signal<Enveloppe | null>(null);
  readonly apporteurs = signal<Apporteur[]>([]);
  readonly clientConfie = signal<ClientConfie | null>(null);
  readonly codes = signal<{ id: string; code: string; nature: string }[]>([]);
  readonly globales = signal<{ id: string; solde: string; echeance: string }[]>([]);
  readonly fondsCompagnie = signal<Fonds[]>([]);

  // Saisie
  readonly apporteurId = signal('');
  readonly typeOperation = signal<TypeOperation>('ARBITRAGE');
  readonly typeClient = signal<TypeClient>('PHYSIQUE');
  readonly clientNom = signal('');
  readonly clientPrenom = signal('');
  readonly numeroContrat = signal('');
  readonly numeroDemande = signal('');
  readonly gammeId = signal('');
  readonly codeApporteurId = signal('');
  readonly montantBrut = signal('');
  readonly frais = signal('0');
  readonly encours = signal('');
  readonly prevendu = signal<boolean | null>(null);
  readonly modeArbitrage = signal<ModeArbitrage>('PAR_FONDS');
  readonly pourcentageArbitrage = signal('');
  readonly valeurContrat = signal('');
  readonly lignes = signal<LigneSaisie[]>([]);
  readonly rechercheFonds = signal('');
  readonly reservationGlobaleId = signal('');
  readonly derogations = signal<Partial<Record<CodeDerogation, string>>>({});

  readonly apercu = signal<Apercu | null>(null);
  readonly envoi = signal(false);
  readonly erreurEnvoi = signal<string | null>(null);
  private compteur = 0;
  private minuterie: ReturnType<typeof setTimeout> | null = null;

  readonly arbitrage = computed(() => this.typeOperation() === 'ARBITRAGE');
  readonly suggestions = computed(() => {
    const saisie = this.rechercheFonds().trim();
    if (!saisie) return [];
    return rechercherFonds(this.fondsCompagnie(), saisie, this.lignes().map((l) => l.fondsId ?? ''), 12);
  });
  readonly totalFonds = computed(() => this.lignes().reduce((t, l) => t + Number(versMontant(l.montant) ?? 0), 0));
  readonly net = computed(() => this.apercu()?.montantNet ?? null);
  readonly resteARepartir = computed(() => (this.net() === null ? null : Number(this.net()) - this.totalFonds()));
  readonly depassement = computed(() => this.apercu()?.derogeables.some((d) => d.code === 'DEPASSEMENT') ?? false);
  readonly derogeablesNonAccordes = computed(() => (this.apercu()?.derogeables ?? []).filter((d) => !(this.gestion() && this.derogations()[d.code as CodeDerogation]?.trim())));
  readonly peutEnvoyer = computed(() => {
    const a = this.apercu();
    if (!a || a.bloquants.length || this.prevendu() === null) return false;
    return this.derogeablesNonAccordes().every((d) => d.code === 'DEPASSEMENT');
  });

  constructor() {
    // Les contrôles et calculs suivent la saisie, sans attendre l'envoi.
    effect(() => {
      this.corps();
      untracked(() => this.programmerApercu());
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const enveloppe = await this.api.enveloppe(this.id());
      this.enveloppe.set(enveloppe);
      this.fondsCompagnie.set(await this.api.fonds(enveloppe.compagnie.id));
      if (this.gestion()) {
        this.apporteurs.set((await this.api.apporteurs()).filter((a) => a.actif));
      } else {
        const moi = await this.api.moi();
        if (!moi) {
          this.erreur.set('Votre compte n’est pas encore rattaché à un apporteur : le cabinet doit le faire avant votre première réservation.');
          return;
        }
        await this.chargerApporteur();
      }
      if (this.confie()) {
        const c = (await this.api.clientsConfies(this.id())).find((x) => x.id === this.confie());
        if (c) {
          this.clientConfie.set(c);
          this.typeClient.set(c.typeClient);
          this.clientNom.set(c.clientNom);
          this.clientPrenom.set(c.clientPrenom ?? '');
          this.numeroContrat.set(c.numeroContrat ?? '');
          this.prevendu.set(true);
        }
      }
    } catch (e) {
      this.erreur.set(messageErreur(e, 'L’enveloppe n’a pas pu être chargée.'));
    } finally {
      this.chargement.set(false);
    }
  }

  async chargerApporteur(): Promise<void> {
    const e = this.enveloppe();
    if (!e) return;
    const apporteur = this.gestion() ? this.apporteurId() : undefined;
    if (this.gestion() && !apporteur) {
      this.codes.set([]);
      this.globales.set([]);
      return;
    }
    const [codes, globales] = await Promise.all([this.api.codesValables(e.compagnie.id, apporteur), this.api.globalesDisponibles(e.id, apporteur)]);
    this.codes.set(codes);
    this.globales.set(globales);
    this.codeApporteurId.set(codes.length === 1 ? codes[0].id : '');
    this.reservationGlobaleId.set('');
  }

  choisirApporteur(id: string): void {
    this.apporteurId.set(id);
    void this.chargerApporteur();
  }

  ajouterFonds(f: Fonds): void {
    this.lignes.update((l) => [...l, { cle: ++this.compteur, fondsId: f.id, nom: f.nom, isin: f.isin ?? '', montant: '', ferme: !f.ouvert }]);
    this.rechercheFonds.set('');
  }

  ajouterHorsReferentiel(): void {
    this.lignes.update((l) => [...l, { cle: ++this.compteur, fondsId: null, nom: this.rechercheFonds().trim(), isin: '', montant: '', ferme: false }]);
    this.rechercheFonds.set('');
  }

  modifierLigne(cle: number, champ: 'montant' | 'nom' | 'isin', valeur: string): void {
    this.lignes.update((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));
  }

  retirerLigne(cle: number): void {
    this.lignes.update((l) => l.filter((x) => x.cle !== cle));
  }

  libelleDerogation(code: string): string {
    return LIBELLES_DEROGATIONS[code as CodeDerogation] ?? code;
  }

  motifDerogation(code: string): string {
    return this.derogations()[code as CodeDerogation] ?? '';
  }

  derogation(code: string, motif: string): void {
    this.derogations.update((d) => ({ ...d, [code]: motif }));
  }

  /** La demande telle qu'elle part au serveur, ou null tant que l'essentiel manque. */
  corps(): Record<string, unknown> | null {
    const brut = versMontant(this.montantBrut());
    const frais = versTaux(this.frais() || '0');
    if (!brut || frais === null || !this.clientNom().trim() || (this.gestion() && !this.apporteurId())) return null;
    const corps: Record<string, unknown> = {
      enveloppeId: this.id(),
      typeOperation: this.typeOperation(),
      typeClient: this.typeClient(),
      clientNom: this.clientNom().trim(),
      clientPrenom: this.typeClient() === 'PHYSIQUE' ? this.clientPrenom().trim() || undefined : undefined,
      numeroContrat: this.numeroContrat().trim() || undefined,
      numeroDemande: this.numeroDemande().trim() || undefined,
      montantBrut: brut,
      tauxFrais: frais,
      clientPrevendu: this.prevendu() ?? false,
      encoursClient: versMontant(this.encours()) ?? undefined,
      gammeId: this.gammeId() || undefined,
      codeApporteurId: this.codeApporteurId() || undefined,
      apporteurId: this.gestion() ? this.apporteurId() : undefined,
      reservationGlobaleId: this.reservationGlobaleId() || undefined,
      clientConfieId: this.clientConfie()?.id,
    };
    if (this.arbitrage()) {
      corps['modeArbitrage'] = this.modeArbitrage();
      if (this.modeArbitrage() === 'GLOBAL') {
        corps['pourcentageArbitrage'] = versTaux(this.pourcentageArbitrage()) ?? undefined;
        corps['valeurContrat'] = versMontant(this.valeurContrat()) ?? undefined;
      } else {
        corps['fonds'] = this.lignes()
          .filter((l) => versMontant(l.montant))
          .map((l) => ({ fondsId: l.fondsId ?? undefined, nom: l.nom, isin: l.isin.trim() || undefined, montant: versMontant(l.montant) }));
      }
    }
    return corps;
  }

  private programmerApercu(): void {
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => void this.calculer(), 350);
  }

  private async calculer(): Promise<void> {
    const corps = this.corps();
    if (!corps) {
      this.apercu.set(null);
      return;
    }
    try {
      this.apercu.set(await this.api.apercu(corps));
    } catch {
      this.apercu.set(null);
    }
  }

  async envoyer(listeAttente = false): Promise<void> {
    const corps = this.corps();
    if (!corps) return;
    const derogations = Object.entries(this.derogations())
      .filter(([code, motif]) => motif?.trim() && this.apercu()?.derogeables.some((d) => d.code === code))
      .map(([code, motif]) => ({ code, motif: motif!.trim() }));
    this.envoi.set(true);
    this.erreurEnvoi.set(null);
    try {
      const r = await this.api.reserver({ ...corps, listeAttente: listeAttente || undefined, derogations: derogations.length ? derogations : undefined });
      await this.router.navigate(['/enveloppes/reservations', r.id], { queryParams: { nouvelle: 1 } });
    } catch (e) {
      const refus = controlesRefuses(e);
      this.erreurEnvoi.set(refus ? [...refus.bloquants, ...refus.derogeables].map((c: Constat) => c.message).join(' ') : codeErreur(e) === 'DEROGATION' ? messageErreur(e) : messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  aujourdhui = aujourdhuiParis;
}
