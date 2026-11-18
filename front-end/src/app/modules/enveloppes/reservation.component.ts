import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { messageErreur } from '../../core/session.types';
import { codeErreur, controlesRefuses, EnveloppesApi } from './enveloppes.api';
import { CategorieMotif, DetailReservation, LIBELLES_DOCUMENTS, LIBELLES_STATUTS, LIBELLES_TYPES, ModeOperation, Motif, tonStatut } from './enveloppes.types';
import { aujourdhuiParis, dateCourte, dateHeure, depuisMontant, depuisTaux, euros, eurosRonds, nomClient, pourcent, versMontant, versTaux } from './formats';

type Panneau =
  | 'modifier'
  | 'annuler'
  | 'operation'
  | 'renvoyer'
  | 'refuser'
  | 'verifier'
  | 'justifier'
  | 'prolonger'
  | 'liberer'
  | 'apres-operation'
  | 'servir'
  | 'taux'
  | 'document'
  | null;

const LIBELLES_ACTIONS: Partial<Record<string, string>> = {
  CREATION: 'Réservation saisie',
  ACCORD_CLIENT_CONFIE: 'Accord du client confié signalé',
  DEROGATION: 'Dérogation accordée',
  MODIFICATION: 'Réservation modifiée',
  BAISSE: 'Baisse du montant (annulation partielle)',
  VALIDATION: 'Réservation validée',
  REFUS: 'Réservation refusée',
  RENVOI: 'Renvoyée pour correction',
  ANNULATION: 'Réservation annulée',
  ACCORD_CLIENT: 'Accord du client déclaré',
  PATRIMOINE: 'Situation patrimoniale renseignée',
  OPERATION_DECLAREE: 'Opération déclarée',
  VERIFICATION: 'Vérification compagnie saisie',
  ECART_JUSTIFIE: 'Écart justifié',
  ECHEANCE: 'Échéance passée',
  PROLONGATION: 'Réservation prolongée',
  LIBERATION: 'Réservation libérée',
  ANNULATION_APRES_OPERATION: 'Annulée après opération',
  SERVIE_LISTE_ATTENTE: 'Servie depuis la liste d’attente',
  TAUX_MODIFIE: 'Taux modifié',
  ENTITE_MODIFIEE: 'Entité modifiée',
  PRODUIT_ANNULE_OU_REPORTE: 'Produit annulé ou reporté',
};

/** Une réservation : où elle en est, ce qui est attendu, et chaque action passée. */
@Component({
  selector: 'app-reservation',
  imports: [RouterLink, FormsModule],
  templateUrl: './reservation.component.html',
  styleUrl: './enveloppes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationComponent implements OnInit {
  private readonly api = inject(EnveloppesApi);

  readonly id = input.required<string>();
  readonly nouvelle = input<string | undefined>();

  readonly euros = euros;
  readonly eurosRonds = eurosRonds;
  readonly pourcent = pourcent;
  readonly dateCourte = dateCourte;
  readonly dateHeure = dateHeure;
  readonly nomClient = nomClient;
  readonly tonStatut = tonStatut;
  readonly libellesStatuts = LIBELLES_STATUTS;
  readonly libellesTypes = LIBELLES_TYPES;
  readonly libellesDocuments = LIBELLES_DOCUMENTS;
  readonly libellesActions = LIBELLES_ACTIONS;

  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly r = signal<DetailReservation | null>(null);
  readonly motifs = signal<Motif[]>([]);
  readonly panneau = signal<Panneau>(null);
  readonly envoi = signal(false);
  readonly erreurPanneau = signal<string | null>(null);
  readonly avertissementTardif = signal<string | null>(null);

  // Saisies
  readonly motifId = signal('');
  readonly commentaire = signal('');
  readonly date = signal(aujourdhuiParis());
  readonly date2 = signal(aujourdhuiParis());
  readonly mode = signal<ModeOperation>('DEMATERIALISE');
  readonly montant = signal('');
  readonly taux = signal('');
  readonly accord = signal(false);
  readonly motifDerogation = signal('');
  readonly fichier = signal<File | null>(null);
  readonly categorieDocument = signal<'JUSTIFICATIF_OPERATION' | 'PREUVE_VERIFICATION'>('JUSTIFICATIF_OPERATION');
  readonly mContrat = signal('');
  readonly mDemande = signal('');
  readonly mBrut = signal('');
  readonly mFrais = signal('');
  readonly mEncours = signal('');
  readonly mPrevendu = signal(true);
  readonly mFonds = signal<{ fondsId: string | null; nom: string; isin: string | null; montant: string }[]>([]);

  readonly statut = computed(() => this.r()?.statut);
  readonly avantOperation = computed(() => ['SOUMISE', 'LISTE_ATTENTE', 'RENVOYEE', 'VALIDEE', 'ECHUE'].includes(this.statut() ?? ''));
  readonly apresOperation = computed(() => ['OPERATION_PASSEE', 'VERIFIEE', 'ECART_A_JUSTIFIER'].includes(this.statut() ?? ''));
  readonly modifiable = computed(() => !!this.r()?.droits.modifier && this.avantOperation());
  readonly peutDeclarerAccord = computed(() => {
    const r = this.r();
    return !!r && r.droits.modifier && r.typeOperation === 'ARBITRAGE' && !r.accordClientLe && ['SOUMISE', 'VALIDEE', 'ECHUE'].includes(r.statut);
  });
  readonly peutDeclarerOperation = computed(() => !!this.r()?.droits.modifier && ['VALIDEE', 'ECHUE'].includes(this.statut() ?? ''));
  readonly patrimoineRequis = computed(() => !!this.r()?.enveloppe.controlePatrimoine);
  readonly decider = computed(() => !!this.r()?.droits.decider);
  readonly lienAvenant = computed(() => this.api.lienAvenant(this.id()));
  readonly lienDocument = (id: string) => this.api.lienDocument(id);
  readonly compagnie = computed(() => {
    const c = this.r()?.enveloppe.compagnie;
    return typeof c === 'string' ? c : (c?.nom ?? '');
  });

  motifsDe(categorie: CategorieMotif): Motif[] {
    return this.motifs().filter((m) => m.categorie === categorie && m.actif);
  }

  async ngOnInit(): Promise<void> {
    if (this.nouvelle()) this.message.set('Réservation envoyée. Vous recevez un accusé de réception par courriel.');
    try {
      const [r, motifs] = await Promise.all([this.api.reservation(this.id()), this.api.motifs()]);
      this.r.set(r);
      this.motifs.set(motifs);
    } catch (e) {
      this.erreur.set(messageErreur(e, 'La réservation n’a pas pu être chargée.'));
    } finally {
      this.chargement.set(false);
    }
  }

  ouvrir(p: Panneau): void {
    if (this.panneau() === p) {
      this.panneau.set(null);
      return;
    }
    this.panneau.set(p);
    this.erreurPanneau.set(null);
    this.avertissementTardif.set(null);
    this.motifId.set('');
    this.commentaire.set('');
    this.accord.set(false);
    const r = this.r()!;
    if (p === 'modifier') {
      this.mContrat.set(r.numeroContrat ?? '');
      this.mDemande.set(r.numeroDemande ?? '');
      this.mBrut.set(depuisMontant(r.montantBrut));
      this.mFrais.set(depuisTaux(r.tauxFrais));
      this.mEncours.set(depuisMontant(r.encoursClient));
      this.mPrevendu.set(r.clientPrevendu);
      this.mFonds.set(r.fonds.map((f) => ({ fondsId: f.fondsId, nom: f.nom, isin: f.isin, montant: depuisMontant(f.montant) })));
    }
    if (p === 'verifier') {
      this.montant.set(depuisMontant(r.montantNet));
      this.date.set(r.dateOperation ?? aujourdhuiParis());
      this.date2.set(aujourdhuiParis());
    }
    if (p === 'servir') this.montant.set(depuisMontant(r.montantBrut));
    if (p === 'taux') this.taux.set(depuisTaux(r.tauxCommission));
    if (p === 'prolonger') this.date.set(r.enveloppe.dateLimiteInterne ?? aujourdhuiParis());
  }

  private async executer(travail: () => Promise<DetailReservation | unknown>, confirmation: string): Promise<boolean> {
    this.envoi.set(true);
    this.erreurPanneau.set(null);
    try {
      const resultat = await travail();
      if (resultat && typeof resultat === 'object' && 'historique' in resultat) this.r.set(resultat as DetailReservation);
      else this.r.set(await this.api.reservation(this.id()));
      this.panneau.set(null);
      this.message.set(confirmation);
      return true;
    } catch (e) {
      const refus = controlesRefuses(e);
      this.erreurPanneau.set(refus ? [...refus.bloquants, ...refus.derogeables].map((c) => c.message).join(' ') : messageErreur(e));
      return false;
    } finally {
      this.envoi.set(false);
    }
  }

  action(nom: string, corps: Record<string, unknown>, confirmation: string): Promise<boolean> {
    return this.executer(() => this.api.action(this.id(), nom, corps), confirmation);
  }

  valider = () => this.action('validation', {}, 'Réservation validée ; le mandataire est prévenu.');
  accordClient = () => this.action('accord-client', {}, 'Accord du client déclaré : l’avenant pré-rempli est disponible.');

  patrimoine(aJour: boolean): Promise<boolean> {
    return this.action('patrimoine', { aJour }, aJour ? 'Situation patrimoniale à jour.' : 'Situation patrimoniale à mettre à jour.');
  }

  motive(nom: string, confirmation: string): Promise<boolean> {
    if (!this.motifId()) {
      this.erreurPanneau.set('Choisissez un motif.');
      return Promise.resolve(false);
    }
    return this.action(nom, { motifId: this.motifId(), commentaire: this.commentaire().trim() || undefined }, confirmation);
  }

  async annuler(confirmeTardive = false): Promise<void> {
    if (!this.motifId()) return this.erreurPanneau.set('Choisissez un motif.');
    this.envoi.set(true);
    this.erreurPanneau.set(null);
    try {
      this.r.set(await this.api.action(this.id(), 'annulation', { motifId: this.motifId(), commentaire: this.commentaire().trim() || undefined, confirmeTardive: confirmeTardive || undefined }));
      this.panneau.set(null);
      this.avertissementTardif.set(null);
      this.message.set('Réservation annulée : le montant revient dans l’enveloppe.');
    } catch (e) {
      if (codeErreur(e) === 'TARDIVE') this.avertissementTardif.set(messageErreur(e));
      else this.erreurPanneau.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  declarerOperation(): Promise<boolean> {
    return this.action('operation', { dateOperation: this.date(), modeOperation: this.mode() }, 'Opération déclarée : la ligne entre dans la file de vérification.');
  }

  verifier(): Promise<boolean> {
    const montantValide = versMontant(this.montant());
    if (!montantValide) {
      this.erreurPanneau.set('Montant validé invalide.');
      return Promise.resolve(false);
    }
    const declaree = this.statut() === 'OPERATION_PASSEE';
    return this.action(
      'verification',
      {
        montantValide,
        dateValidationCompagnie: this.date2(),
        dateOperation: declaree ? undefined : this.date(),
        modeOperation: declaree ? undefined : this.mode(),
        motifEcartId: this.motifId() || undefined,
        commentaire: this.commentaire().trim() || undefined,
      },
      'Vérification enregistrée.',
    );
  }

  justifier(): Promise<boolean> {
    if (!this.motifId()) {
      this.erreurPanneau.set('Choisissez un motif d’écart.');
      return Promise.resolve(false);
    }
    return this.action('justification-ecart', { motifEcartId: this.motifId(), commentaire: this.commentaire().trim() || undefined }, 'Écart justifié.');
  }

  prolonger = () => this.action('prolongation', { compteRendu: this.commentaire(), echeance: this.date() }, 'Réservation prolongée ; le mandataire est prévenu.');
  liberer = () => this.action('liberation', { compteRendu: this.commentaire() }, 'Réservation libérée : le montant revient dans l’enveloppe.');

  servir(): Promise<boolean> {
    const brut = versMontant(this.montant());
    const partiel = brut && Number(brut) < Number(this.r()!.montantBrut);
    return this.action(
      'service',
      {
        montantBrut: partiel ? brut : undefined,
        accordMandataire: partiel ? this.accord() : undefined,
        motifHorsOrdre: this.commentaire().trim() || undefined,
        motifDerogation: this.motifDerogation().trim() || undefined,
      },
      'Demande servie : elle passe en validation.',
    );
  }

  modifierTaux(): Promise<boolean> {
    const taux = versTaux(this.taux());
    if (!taux) {
      this.erreurPanneau.set('Taux invalide.');
      return Promise.resolve(false);
    }
    return this.action('taux', { taux, motif: this.commentaire() }, 'Taux modifié.');
  }

  modifier(): Promise<boolean> {
    const r = this.r()!;
    const brut = versMontant(this.mBrut());
    const frais = versTaux(this.mFrais() || '0');
    if (!brut || frais === null) {
      this.erreurPanneau.set('Montant ou frais invalides.');
      return Promise.resolve(false);
    }
    const corps: Record<string, unknown> = {
      numeroContrat: this.mContrat().trim(),
      numeroDemande: this.mDemande().trim(),
      montantBrut: brut,
      tauxFrais: frais,
      clientPrevendu: this.mPrevendu(),
      encoursClient: versMontant(this.mEncours()) ?? undefined,
      motifBaisseId: this.motifId() || undefined,
      commentaire: this.commentaire().trim() || undefined,
    };
    if (r.modeArbitrage === 'PAR_FONDS') {
      corps['fonds'] = this.mFonds().map((f) => ({ fondsId: f.fondsId ?? undefined, nom: f.nom, isin: f.isin ?? undefined, montant: versMontant(f.montant) ?? '0' }));
    }
    return this.executer(() => this.api.modifierReservation(this.id(), corps), 'Réservation modifiée ; la modification est tracée.');
  }

  modifierFonds(index: number, montant: string): void {
    this.mFonds.update((l) => l.map((f, i) => (i === index ? { ...f, montant } : f)));
  }

  baisse(): boolean {
    const brut = versMontant(this.mBrut());
    const frais = versTaux(this.mFrais() || '0');
    if (!brut || frais === null) return false;
    return Number(brut) * (1 - Number(frais)) < Number(this.r()!.montantNet) - 0.004;
  }

  choisirFichier(evenement: Event): void {
    this.fichier.set((evenement.target as HTMLInputElement).files?.[0] ?? null);
  }

  async deposer(): Promise<void> {
    const f = this.fichier();
    if (!f) return this.erreurPanneau.set('Choisissez un fichier PDF, PNG ou JPEG.');
    await this.executer(() => this.api.deposerDocumentReservation(this.id(), this.categorieDocument(), f), 'Document déposé.');
    this.fichier.set(null);
  }

  detailHistorique(details: Record<string, unknown> | null): string {
    if (!details) return '';
    const morceaux: string[] = [];
    if (typeof details['motif'] === 'string') morceaux.push(`Motif : ${details['motif']}`);
    if (typeof details['montantRetire'] === 'string') morceaux.push(`${euros(details['montantRetire'] as string)} retirés${details['tardive'] ? ', tardive' : ''}`);
    if (typeof details['montantValide'] === 'string') morceaux.push(`Validé ${euros(details['montantValide'] as string)}, écart ${euros(details['ecart'] as string)}`);
    if (typeof details['echeance'] === 'string') morceaux.push(`Échéance ${dateCourte(details['echeance'] as string)}`);
    if (typeof details['avenant'] === 'string') morceaux.push(details['avenant'] as string);
    if (typeof details['pourLeCompteDe'] === 'string') morceaux.push(`Saisie pour ${details['pourLeCompteDe']}`);
    if (typeof details['code'] === 'string') morceaux.push(String(details['code']).replace('_', ' ').toLowerCase());
    return morceaux.join(' · ');
  }
}
