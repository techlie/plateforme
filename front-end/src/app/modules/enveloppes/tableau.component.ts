import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { messageErreur, PROFILS_ADMINISTRATION } from '../../core/session.types';
import { EnveloppesApi } from './enveloppes.api';
import {
  actionMandataire,
  Apporteur,
  ClientConfie,
  Convention,
  Enveloppe,
  Fiabilite,
  LIBELLES_STATUTS,
  LIBELLES_STATUTS_ENVELOPPE,
  LIBELLES_TYPES,
  Reservation,
  tonStatut,
} from './enveloppes.types';
import { compteARebours, dateCourte, euros, eurosRonds, initiales, nomClient, pourcent } from './formats';

const FILES = [
  { cle: 'a-valider', libelle: 'À valider', statuts: ['SOUMISE'] },
  { cle: 'a-verifier', libelle: 'À vérifier', statuts: ['OPERATION_PASSEE'] },
  { cle: 'ecarts', libelle: 'Écarts', statuts: ['ECART_A_JUSTIFIER'] },
  { cle: 'echues', libelle: 'Échues', statuts: ['ECHUE'] },
  { cle: 'attente', libelle: 'Liste d’attente', statuts: ['LISTE_ATTENTE'] },
] as const;

/**
 * Entrée du module. Le mandataire y voit ses commissions, ce qu'il a à faire, les enveloppes
 * ouvertes et ses réservations ; le back-office et l'administrateur, les files à traiter et
 * toutes les enveloppes.
 */
@Component({
  selector: 'app-enveloppes-tableau',
  imports: [RouterLink],
  templateUrl: './tableau.component.html',
  styleUrl: './enveloppes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableauEnveloppesComponent implements OnInit {
  private readonly api = inject(EnveloppesApi);
  private readonly session = inject(SessionService);

  readonly euros = euros;
  readonly eurosRonds = eurosRonds;
  readonly pourcent = pourcent;
  readonly dateCourte = dateCourte;
  readonly compteARebours = compteARebours;
  readonly nomClient = nomClient;
  readonly initiales = initiales;
  readonly tonStatut = tonStatut;
  readonly libellesStatuts = LIBELLES_STATUTS;
  readonly libellesEnveloppes = LIBELLES_STATUTS_ENVELOPPE;
  readonly libellesTypes = LIBELLES_TYPES;
  readonly actionMandataire = actionMandataire;
  readonly files = FILES;

  readonly gestion = computed(() => ['SUPER_ADMINISTRATEUR', 'ADMINISTRATEUR', 'BACK_OFFICE'].includes(this.session.utilisateur()?.profil ?? ''));
  readonly administrateur = computed(() => PROFILS_ADMINISTRATION.includes(this.session.utilisateur()!.profil));

  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly enveloppes = signal<Enveloppe[]>([]);
  readonly reservations = signal<Reservation[]>([]);
  readonly confies = signal<ClientConfie[]>([]);
  readonly fiabilite = signal<Fiabilite | null>(null);
  readonly moi = signal<Apporteur | null>(null);
  /** Décision du 18 novembre : le mandataire voit et télécharge ses conventions. */
  readonly conventions = signal<Convention[]>([]);

  readonly ouvertes = computed(() => this.enveloppes().filter((e) => e.statut === 'OUVERTE'));
  readonly actives = computed(() => this.reservations().filter((r) => !['REFUSEE', 'LIBEREE', 'ANNULEE', 'ANNULEE_APRES_OPERATION'].includes(r.statut)));
  readonly commissionTotale = computed(() => this.actives().reduce((t, r) => t + Number(r.commissionEstimee), 0).toFixed(2));
  readonly commissionDefinitive = computed(() => this.actives().reduce((t, r) => t + Number(r.commissionDefinitive ?? 0), 0).toFixed(2));
  readonly totalReserve = computed(() => this.actives().reduce((t, r) => t + Number(r.montantNet), 0).toFixed(2));
  readonly totalValide = computed(() => this.actives().reduce((t, r) => t + Number(r.montantValide ?? 0), 0).toFixed(2));
  readonly aFaire = computed(() => this.actives().filter((r) => actionMandataire(r) !== null));
  readonly confiesAContacter = computed(() => this.confies().filter((c) => c.statut === 'CONFIE'));

  readonly comptesFiles = computed(() => {
    const parStatut = new Map<string, number>();
    for (const r of this.reservations()) parStatut.set(r.statut, (parStatut.get(r.statut) ?? 0) + 1);
    return FILES.map((f) => ({ ...f, nombre: f.statuts.reduce((t, s) => t + (parStatut.get(s) ?? 0), 0) }));
  });
  readonly totalATraiter = computed(() => this.comptesFiles().reduce((t, f) => t + f.nombre, 0));

  async ngOnInit(): Promise<void> {
    try {
      if (this.gestion()) {
        const [enveloppes, reservations] = await Promise.all([this.api.enveloppes(), this.api.reservations({ file: 'actives' })]);
        this.enveloppes.set(enveloppes);
        this.reservations.set(reservations);
      } else {
        const [enveloppes, reservations, confies, fiabilite, moi, conventions] = await Promise.all([
          this.api.enveloppes(),
          this.api.reservations(),
          this.api.clientsConfies(),
          this.api.fiabilite(),
          this.api.moi(),
          this.api.mesConventions(),
        ]);
        this.conventions.set(conventions);
        this.enveloppes.set(enveloppes);
        this.reservations.set(reservations);
        this.confies.set(confies);
        this.fiabilite.set(fiabilite[0] ?? null);
        this.moi.set(moi);
      }
    } catch (e) {
      this.erreur.set(messageErreur(e, 'Les enveloppes n’ont pas pu être chargées.'));
    } finally {
      this.chargement.set(false);
    }
  }

  remplissage(e: Enveloppe): number {
    return Math.min(100, Math.max(0, Number(e.compteurs.tauxRemplissage) * 100));
  }

  lienConvention(documentId: string): string {
    return this.api.lienConvention(documentId);
  }

  produit(r: Reservation): string {
    return r.enveloppe.nomProduit;
  }
}
