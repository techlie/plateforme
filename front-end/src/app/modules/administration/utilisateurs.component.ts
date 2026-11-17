import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { LIBELLES_MODULES, LIBELLES_PROFILS, messageErreur, ModulePlateforme, Profil } from '../../core/session.types';
import { AdministrationApi, dateLisible, Entite, FicheUtilisateur } from './administration.api';

type Edition = { mode: 'creation' } | { mode: 'modification'; fiche: FicheUtilisateur };

const MODULES: ModulePlateforme[] = ['SIMULATEUR', 'ENVELOPPES', 'AFFAIRES', 'BORDEREAU', 'SYNTHESE_CONTRATS'];
const PROFILS: Profil[] = ['MANDATAIRE', 'GESTIONNAIRE_PORTEFEUILLE', 'BACK_OFFICE', 'ADMINISTRATEUR', 'SUPER_ADMINISTRATEUR'];

/** Modules cochés d'office à la création, selon le profil. Ils restent modifiables. */
const MODULES_PAR_DEFAUT: Record<Profil, ModulePlateforme[]> = {
  SUPER_ADMINISTRATEUR: [],
  ADMINISTRATEUR: ['SIMULATEUR', 'ENVELOPPES'],
  BACK_OFFICE: ['ENVELOPPES'],
  MANDATAIRE: ['SIMULATEUR', 'ENVELOPPES'],
  GESTIONNAIRE_PORTEFEUILLE: [],
};

@Component({
  selector: 'app-utilisateurs',
  imports: [RouterLink],
  templateUrl: './utilisateurs.component.html',
  styleUrl: './administration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UtilisateursComponent implements OnInit {
  private readonly api = inject(AdministrationApi);
  private readonly session = inject(SessionService);

  readonly libellesProfils = LIBELLES_PROFILS;
  readonly libellesModules = LIBELLES_MODULES;
  readonly modules = MODULES;
  readonly dateLisible = dateLisible;

  readonly utilisateurs = signal<FicheUtilisateur[]>([]);
  readonly entites = signal<Entite[]>([]);
  readonly chargement = signal(true);
  readonly erreurListe = signal<string | null>(null);
  readonly recherche = signal('');
  readonly confirmation = signal<string | null>(null);

  readonly edition = signal<Edition | null>(null);
  readonly email = signal('');
  readonly prenom = signal('');
  readonly nom = signal('');
  readonly profil = signal<Profil>('MANDATAIRE');
  readonly entiteId = signal<string>('');
  readonly modulesCoches = signal<ModulePlateforme[]>([]);
  readonly actif = signal(true);
  readonly erreurFiche = signal<string | null>(null);
  readonly envoi = signal(false);

  readonly moi = this.session.utilisateur;
  readonly estSuperAdministrateur = computed(() => this.moi()?.profil === 'SUPER_ADMINISTRATEUR');
  readonly profilsProposes = computed(() => PROFILS.filter((p) => p !== 'SUPER_ADMINISTRATEUR' || this.estSuperAdministrateur()));
  readonly entitesActives = computed(() => this.entites().filter((e) => e.actif));
  readonly ficheEnCours = computed(() => {
    const e = this.edition();
    return e?.mode === 'modification' ? e.fiche : null;
  });
  readonly soiMeme = computed(() => this.ficheEnCours()?.id === this.moi()?.id);
  readonly ficheVerrouillee = computed(() => {
    const fiche = this.ficheEnCours();
    return !!fiche && fiche.profil === 'SUPER_ADMINISTRATEUR' && !this.estSuperAdministrateur();
  });

  readonly liste = computed(() => {
    const filtre = this.recherche().trim().toLowerCase();
    if (!filtre) return this.utilisateurs();
    return this.utilisateurs().filter((u) =>
      `${u.prenom} ${u.nom} ${u.email} ${u.entite?.nom ?? ''} ${LIBELLES_PROFILS[u.profil]}`.toLowerCase().includes(filtre),
    );
  });

  async ngOnInit(): Promise<void> {
    await this.recharger();
  }

  async recharger(): Promise<void> {
    this.chargement.set(true);
    try {
      const [utilisateurs, entites] = await Promise.all([this.api.utilisateurs(), this.api.entites()]);
      this.utilisateurs.set(utilisateurs);
      this.entites.set(entites);
      this.erreurListe.set(null);
    } catch (erreur) {
      this.erreurListe.set(messageErreur(erreur, 'La liste des comptes n’a pas pu être chargée.'));
    } finally {
      this.chargement.set(false);
    }
  }

  etat(u: FicheUtilisateur): { libelle: string; classe: string } {
    if (!u.actif) return { libelle: 'Désactivé', classe: 'etat--eteint' };
    if (u.bloque) return { libelle: 'Bloqué un moment', classe: 'etat--alerte' };
    if (!u.compteActive) return { libelle: 'Invitation envoyée', classe: 'etat--attente' };
    return { libelle: 'Actif', classe: 'etat--actif' };
  }

  libelleModules(u: FicheUtilisateur): string {
    if (u.profil === 'SUPER_ADMINISTRATEUR') return 'Tous les modules';
    return u.modules.length ? u.modules.map((m) => LIBELLES_MODULES[m]).join(', ') : 'Aucun module';
  }

  ouvrirCreation(): void {
    this.confirmation.set(null);
    this.erreurFiche.set(null);
    this.email.set('');
    this.prenom.set('');
    this.nom.set('');
    this.profil.set('MANDATAIRE');
    this.entiteId.set(this.entitesActives().find((e) => e.nom === 'SR CONSEIL')?.id ?? '');
    this.modulesCoches.set([...MODULES_PAR_DEFAUT.MANDATAIRE]);
    this.actif.set(true);
    this.edition.set({ mode: 'creation' });
  }

  ouvrirModification(fiche: FicheUtilisateur): void {
    this.confirmation.set(null);
    this.erreurFiche.set(null);
    this.email.set(fiche.email);
    this.prenom.set(fiche.prenom);
    this.nom.set(fiche.nom);
    this.profil.set(fiche.profil);
    this.entiteId.set(fiche.entite?.id ?? '');
    this.modulesCoches.set(fiche.profil === 'SUPER_ADMINISTRATEUR' ? [] : [...fiche.modules]);
    this.actif.set(fiche.actif);
    this.edition.set({ mode: 'modification', fiche });
  }

  fermer(): void {
    this.edition.set(null);
  }

  changerProfil(valeur: string): void {
    const profil = valeur as Profil;
    this.profil.set(profil);
    if (this.edition()?.mode === 'creation') {
      this.modulesCoches.set([...MODULES_PAR_DEFAUT[profil]]);
    }
  }

  basculerModule(module: ModulePlateforme, coche: boolean): void {
    this.modulesCoches.update((liste) => (coche ? [...liste, module] : liste.filter((m) => m !== module)));
  }

  valeur(evenement: Event): string {
    return (evenement.target as HTMLInputElement).value;
  }

  coche(evenement: Event): boolean {
    return (evenement.target as HTMLInputElement).checked;
  }

  async enregistrer(evenement: Event): Promise<void> {
    evenement.preventDefault();
    const edition = this.edition();
    if (!edition || this.envoi()) return;
    this.erreurFiche.set(null);
    this.envoi.set(true);
    try {
      if (edition.mode === 'creation') {
        const cree = await this.api.creerUtilisateur({
          email: this.email().trim(),
          prenom: this.prenom().trim(),
          nom: this.nom().trim(),
          profil: this.profil(),
          entiteId: this.entiteId() || undefined,
          modules: this.profil() === 'SUPER_ADMINISTRATEUR' ? [] : this.modulesCoches(),
        });
        this.confirmation.set(`Compte créé pour ${cree.prenom} ${cree.nom}. Le lien pour choisir son mot de passe lui est envoyé.`);
      } else {
        const fiche = edition.fiche;
        const modifie = await this.api.modifierUtilisateur(fiche.id, {
          prenom: this.prenom().trim(),
          nom: this.nom().trim(),
          profil: this.soiMeme() ? undefined : this.profil(),
          entiteId: this.entiteId() || null,
          modules: this.profil() === 'SUPER_ADMINISTRATEUR' ? [] : this.modulesCoches(),
          actif: this.soiMeme() ? undefined : this.actif(),
        });
        this.confirmation.set(
          !modifie.actif && fiche.actif
            ? `Compte de ${modifie.prenom} ${modifie.nom} désactivé : son accès est coupé.`
            : `Compte de ${modifie.prenom} ${modifie.nom} enregistré.`,
        );
      }
      this.edition.set(null);
      await this.recharger();
    } catch (erreur) {
      this.erreurFiche.set(messageErreur(erreur));
    } finally {
      this.envoi.set(false);
    }
  }

  async renvoyerLien(): Promise<void> {
    const fiche = this.ficheEnCours();
    if (!fiche) return;
    this.erreurFiche.set(null);
    try {
      await this.api.renvoyerLien(fiche.id);
      this.confirmation.set(
        fiche.compteActive
          ? `Un lien pour choisir un nouveau mot de passe est envoyé à ${fiche.prenom} ${fiche.nom}.`
          : `Le lien d’activation est renvoyé à ${fiche.prenom} ${fiche.nom}.`,
      );
      this.edition.set(null);
    } catch (erreur) {
      this.erreurFiche.set(messageErreur(erreur));
    }
  }
}
