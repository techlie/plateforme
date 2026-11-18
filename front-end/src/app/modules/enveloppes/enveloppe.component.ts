import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { messageErreur, PROFILS_ADMINISTRATION } from '../../core/session.types';
import { EnveloppesApi } from './enveloppes.api';
import {
  Apporteur,
  CategorieDocument,
  ClientConfie,
  Enveloppe,
  LIBELLES_DOCUMENTS,
  LIBELLES_STATUTS,
  LIBELLES_STATUTS_ENVELOPPE,
  LIBELLES_TYPES,
  Reservation,
  tonStatut,
} from './enveloppes.types';
import { compteARebours, dateCourte, dateHeure, depuisTaux, euros, eurosRonds, nomClient, pourcent, versMontant, versTaux } from './formats';

type Onglet = 'toutes' | 'a-valider' | 'a-verifier' | 'ecarts' | 'echues' | 'attente' | 'concentration';
type Panneau = 'rallonge' | 'globale' | 'confie' | 'produit' | 'document' | null;

const ONGLETS: { cle: Onglet; libelle: string; garde: (r: Reservation) => boolean }[] = [
  { cle: 'toutes', libelle: 'Toutes', garde: () => true },
  { cle: 'a-valider', libelle: 'À valider', garde: (r) => r.statut === 'SOUMISE' },
  { cle: 'a-verifier', libelle: 'À vérifier', garde: (r) => r.statut === 'OPERATION_PASSEE' },
  { cle: 'ecarts', libelle: 'Écarts', garde: (r) => r.statut === 'ECART_A_JUSTIFIER' },
  { cle: 'echues', libelle: 'Échues', garde: (r) => r.statut === 'ECHUE' },
  { cle: 'attente', libelle: 'Liste d’attente', garde: (r) => r.statut === 'LISTE_ATTENTE' },
  { cle: 'concentration', libelle: 'Concentration', garde: (r) => r.signalements.includes('CONCENTRATION') },
];

/**
 * Suivi d'une enveloppe. Le back-office y voit les deux compteurs côte à côte et traite les files ;
 * le mandataire y lit la fiche, les conditions et ses propres réservations.
 */
@Component({
  selector: 'app-enveloppe',
  imports: [RouterLink, FormsModule],
  templateUrl: './enveloppe.component.html',
  styleUrl: './enveloppes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnveloppeComponent implements OnInit {
  private readonly api = inject(EnveloppesApi);
  private readonly session = inject(SessionService);

  readonly id = input.required<string>();

  readonly euros = euros;
  readonly eurosRonds = eurosRonds;
  readonly pourcent = pourcent;
  readonly dateCourte = dateCourte;
  readonly dateHeure = dateHeure;
  readonly compteARebours = compteARebours;
  readonly nomClient = nomClient;
  readonly tonStatut = tonStatut;
  readonly libellesStatuts = LIBELLES_STATUTS;
  readonly libellesEnveloppes = LIBELLES_STATUTS_ENVELOPPE;
  readonly libellesTypes = LIBELLES_TYPES;
  readonly libellesDocuments = LIBELLES_DOCUMENTS;
  readonly onglets = ONGLETS;
  readonly categoriesDocuments: CategorieDocument[] = ['FICHE_PRODUIT', 'DOCUMENTATION_TECHNIQUE', 'AVENANT_COMPAGNIE', 'AVENANT_VIERGE'];

  private readonly profil = computed(() => this.session.utilisateur()?.profil);
  readonly gestion = computed(() => ['SUPER_ADMINISTRATEUR', 'ADMINISTRATEUR', 'BACK_OFFICE'].includes(this.profil() ?? ''));
  readonly administrateur = computed(() => PROFILS_ADMINISTRATION.includes(this.profil()!));
  readonly superAdministrateur = computed(() => this.profil() === 'SUPER_ADMINISTRATEUR');

  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly enveloppe = signal<Enveloppe | null>(null);
  readonly reservations = signal<Reservation[]>([]);
  readonly confies = signal<ClientConfie[]>([]);
  readonly apporteurs = signal<Apporteur[]>([]);
  readonly onglet = signal<Onglet>('toutes');
  readonly panneau = signal<Panneau>(null);
  readonly envoi = signal(false);
  readonly erreurPanneau = signal<string | null>(null);

  // Saisies des panneaux
  readonly mvtType = signal<'RALLONGE' | 'RESTITUTION'>('RALLONGE');
  readonly mvtMontant = signal('');
  readonly mvtMotif = signal('');
  readonly glApporteur = signal('');
  readonly glMontant = signal('');
  readonly glMotif = signal('');
  readonly glEcheance = signal('');
  readonly cfApporteur = signal('');
  readonly cfType = signal<'PHYSIQUE' | 'MORALE'>('PHYSIQUE');
  readonly cfNom = signal('');
  readonly cfPrenom = signal('');
  readonly cfContrat = signal('');
  readonly cfTaux = signal('');
  readonly prStatut = signal<'ANNULEE' | 'REPORTEE'>('REPORTEE');
  readonly prMotif = signal('');
  readonly docCategorie = signal<CategorieDocument>('FICHE_PRODUIT');
  readonly docFichier = signal<File | null>(null);
  readonly upfront = signal('');
  readonly libGlobale = signal<string | null>(null);
  readonly libMontant = signal('');
  readonly libMotif = signal('');

  readonly visibles = computed(() => {
    const garde = ONGLETS.find((o) => o.cle === this.onglet())!.garde;
    return this.reservations().filter(garde);
  });
  readonly comptes = computed(() => new Map(ONGLETS.map((o) => [o.cle, this.reservations().filter(o.garde).length])));
  readonly remplissage = computed(() => Math.min(100, Math.max(0, Number(this.enveloppe()?.compteurs.tauxRemplissage ?? 0) * 100)));
  readonly reel = computed(() => Math.min(100, Math.max(0, Number(this.enveloppe()?.compteurs.tauxReel ?? 0) * 100)));
  readonly reserveTotal = computed(() => {
    const e = this.enveloppe();
    return e ? (Number(e.compteurs.enveloppeTotale) - Number(e.compteurs.restante)).toFixed(2) : '0';
  });
  readonly apporteursHabilites = computed(() => this.apporteurs().filter((a) => a.actif && a.habiliteReservationGlobale));
  readonly apporteursActifs = computed(() => this.apporteurs().filter((a) => a.actif));
  readonly lienExport = computed(() => this.api.lienExport({ enveloppe: this.id() }));
  readonly lienDocument = (id: string) => this.api.lienDocument(id);

  async ngOnInit(): Promise<void> {
    await this.charger();
  }

  async charger(): Promise<void> {
    try {
      const [enveloppe, reservations] = await Promise.all([this.api.enveloppe(this.id()), this.api.reservations({ enveloppe: this.id() })]);
      this.enveloppe.set(enveloppe);
      this.reservations.set(reservations);
      this.upfront.set(depuisTaux(enveloppe.upfrontReel ?? null));
      if (this.gestion()) {
        const [confies, apporteurs] = await Promise.all([this.api.clientsConfies(this.id()), this.api.apporteurs()]);
        this.confies.set(confies);
        this.apporteurs.set(apporteurs);
        this.cfTaux.set(depuisTaux(enveloppe.tauxClientsConfies));
      }
    } catch (e) {
      this.erreur.set(messageErreur(e, 'L’enveloppe n’a pas pu être chargée.'));
    } finally {
      this.chargement.set(false);
    }
  }

  basculer(p: Panneau): void {
    this.panneau.set(this.panneau() === p ? null : p);
    this.erreurPanneau.set(null);
  }

  private async executer(travail: () => Promise<unknown>, confirmation: string): Promise<void> {
    this.envoi.set(true);
    this.erreurPanneau.set(null);
    try {
      await travail();
      this.panneau.set(null);
      this.message.set(confirmation);
      await this.charger();
    } catch (e) {
      this.erreurPanneau.set(messageErreur(e));
    } finally {
      this.envoi.set(false);
    }
  }

  ouvrir(): Promise<void> {
    return this.executer(() => this.api.ouvrir(this.id()), 'L’enveloppe est ouverte aux réservations.');
  }

  cloturer(): Promise<void> {
    return this.executer(() => this.api.cloturer(this.id()), 'L’enveloppe est clôturée.');
  }

  valider(r: Reservation): Promise<void> {
    return this.executer(() => this.api.action(r.id, 'validation'), `Réservation n° ${r.numero} validée.`);
  }

  async mouvement(): Promise<void> {
    const montant = versMontant(this.mvtMontant());
    if (!montant) return this.erreurPanneau.set('Montant invalide.');
    await this.executer(() => this.api.mouvement(this.id(), { type: this.mvtType(), montant, motif: this.mvtMotif() }), this.mvtType() === 'RALLONGE' ? 'Rallonge enregistrée.' : 'Restitution enregistrée.');
  }

  async globale(): Promise<void> {
    const montant = versMontant(this.glMontant());
    if (!montant || !this.glApporteur() || !this.glEcheance()) return this.erreurPanneau.set('Apporteur, montant et échéance sont obligatoires.');
    await this.executer(
      () => this.api.creerGlobale(this.id(), { apporteurId: this.glApporteur(), montant, motif: this.glMotif(), echeance: this.glEcheance() }),
      'Réservation globale posée ; l’administrateur et le back-office sont prévenus.',
    );
  }

  async libererGlobale(): Promise<void> {
    const montant = versMontant(this.libMontant());
    if (!montant || !this.libMotif().trim()) return this.erreurPanneau.set('Montant et motif sont obligatoires.');
    await this.executer(() => this.api.libererGlobale(this.libGlobale()!, { montant, motif: this.libMotif() }), 'Solde libéré ; l’administrateur et le back-office sont prévenus.');
    this.libGlobale.set(null);
  }

  async confier(): Promise<void> {
    const taux = versTaux(this.cfTaux());
    if (!this.cfApporteur() || !this.cfNom() || !taux) return this.erreurPanneau.set('Mandataire, nom du client et taux sont obligatoires.');
    await this.executer(
      () =>
        this.api.confier(this.id(), {
          apporteurId: this.cfApporteur(),
          typeClient: this.cfType(),
          clientNom: this.cfNom(),
          clientPrenom: this.cfType() === 'PHYSIQUE' ? this.cfPrenom() || undefined : undefined,
          numeroContrat: this.cfContrat() || undefined,
          taux,
        }),
      'Client confié ; le mandataire est prévenu.',
    );
    this.cfNom.set('');
    this.cfPrenom.set('');
    this.cfContrat.set('');
  }

  retirerConfie(c: ClientConfie): Promise<void> {
    return this.executer(() => this.api.retirerConfie(c.id), 'Affectation retirée.');
  }

  produit(): Promise<void> {
    return this.executer(() => this.api.statutProduit(this.id(), { statut: this.prStatut(), motif: this.prMotif() }), 'Le produit est marqué ; les mandataires sont prévenus.');
  }

  choisirFichier(evenement: Event): void {
    const fichiers = (evenement.target as HTMLInputElement).files;
    this.docFichier.set(fichiers?.[0] ?? null);
  }

  async deposer(): Promise<void> {
    const fichier = this.docFichier();
    if (!fichier) return this.erreurPanneau.set('Choisissez un fichier PDF, PNG ou JPEG.');
    await this.executer(() => this.api.deposerDocumentEnveloppe(this.id(), this.docCategorie(), fichier), 'Document déposé.');
    this.docFichier.set(null);
  }

  async enregistrerUpfront(): Promise<void> {
    const taux = this.upfront().trim() === '' ? '' : versTaux(this.upfront());
    if (taux === null) return this.erreurPanneau.set('Taux invalide.');
    await this.executer(() => this.api.upfront(this.id(), taux), 'Upfront enregistré.');
  }

  peutValider(r: Reservation): boolean {
    return r.statut === 'SOUMISE' && !r.estApporteur && (!r.accordAdministrateur || this.administrateur());
  }
}
