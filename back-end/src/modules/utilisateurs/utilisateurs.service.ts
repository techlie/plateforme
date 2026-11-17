import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LIBELLES_PROFILS, modulesEffectifs, nomComplet, UtilisateurConnecte } from '../../shared/acces/acces.types';
import { JournalService } from '../../shared/journal/journal.service';
import { normaliserAdresse } from '../../shared/securite/securite';
import { AuthService } from '../auth/auth.service';
import { CreationUtilisateurDto, ModificationUtilisateurDto } from './dto/utilisateurs.dto';
import type { FicheUtilisateur } from './dto/utilisateurs.reponses';
import { LigneUtilisateur, UtilisateursRepository } from './utilisateurs.repository';

function fiche(u: LigneUtilisateur, maintenant = new Date()): FicheUtilisateur {
  return {
    id: u.id,
    email: u.email,
    nom: u.nom,
    prenom: u.prenom,
    profil: u.profil,
    actif: u.actif,
    compteActive: u.motDePasse !== null,
    bloque: !!u.bloqueJusqua && u.bloqueJusqua > maintenant,
    entite: u.entite,
    modules: modulesEffectifs(
      u.profil,
      u.modules.map((m) => m.module),
    ),
    derniereConnexion: u.derniereConnexion?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

/**
 * Gestion des comptes, réservée aux administrateurs et super administrateurs.
 * Règles de sécurité :
 * - seul un super administrateur crée, modifie ou nomme un super administrateur ;
 * - personne ne change son propre profil ni ne désactive son propre compte ;
 * - une désactivation ou un changement de profil ferme aussitôt les sessions ouvertes ;
 * - une adresse de connexion n'appartient qu'à une personne.
 */
@Injectable()
export class UtilisateursService {
  constructor(
    private readonly repository: UtilisateursRepository,
    private readonly auth: AuthService,
    private readonly journal: JournalService,
  ) {}

  async lister(): Promise<FicheUtilisateur[]> {
    const maintenant = new Date();
    return (await this.repository.lister()).map((u) => fiche(u, maintenant));
  }

  async creer(dto: CreationUtilisateurDto, auteur: UtilisateurConnecte): Promise<FicheUtilisateur> {
    if (dto.profil === 'SUPER_ADMINISTRATEUR' && auteur.profil !== 'SUPER_ADMINISTRATEUR') {
      throw new ForbiddenException({ code: 'SUPER_ADMIN', message: 'Seul un super administrateur peut créer un super administrateur.' });
    }
    const email = normaliserAdresse(dto.email);
    if (await this.repository.emailExiste(email)) {
      throw new ConflictException({ code: 'ADRESSE_PRISE', message: 'Cette adresse est déjà celle d’un autre compte. Chaque personne a sa propre adresse.' });
    }
    if (dto.entiteId && !(await this.repository.entiteExiste(dto.entiteId))) {
      throw new BadRequestException({ code: 'ENTITE', message: 'Entité inconnue.' });
    }
    const cree = await this.repository.creer({
      email,
      nom: dto.nom.trim(),
      prenom: dto.prenom.trim(),
      profil: dto.profil,
      entiteId: dto.entiteId,
      modules: dto.modules,
    });
    await this.journal.ecrire({
      action: 'UTILISATEUR_CREE',
      message: `Compte créé pour ${nomComplet(cree)}, ${LIBELLES_PROFILS[cree.profil]}.`,
      succes: true,
      userId: auteur.id,
      auteur: nomComplet(auteur),
      cible: cree.id,
      details: { email, profil: cree.profil, modules: dto.modules, entiteId: dto.entiteId ?? null },
    });
    // L'invitation part aussitôt : la personne choisit elle-même son mot de passe.
    await this.auth.demanderReinitialisation(email, { adresseIp: null, navigateur: null }, auteur);
    return fiche(cree);
  }

  async modifier(id: string, dto: ModificationUtilisateurDto, auteur: UtilisateurConnecte): Promise<FicheUtilisateur> {
    const avant = await this.repository.trouver(id);
    if (!avant) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Compte introuvable.' });
    }
    const touchePrivilege = avant.profil === 'SUPER_ADMINISTRATEUR' || dto.profil === 'SUPER_ADMINISTRATEUR';
    if (touchePrivilege && auteur.profil !== 'SUPER_ADMINISTRATEUR') {
      throw new ForbiddenException({ code: 'SUPER_ADMIN', message: 'Seul un super administrateur peut modifier un super administrateur.' });
    }
    if (id === auteur.id && ((dto.profil && dto.profil !== avant.profil) || dto.actif === false)) {
      throw new ForbiddenException({ code: 'SOI_MEME', message: 'Vous ne pouvez pas changer votre propre profil ni désactiver votre propre compte.' });
    }
    if (dto.entiteId && !(await this.repository.entiteExiste(dto.entiteId))) {
      throw new BadRequestException({ code: 'ENTITE', message: 'Entité inconnue.' });
    }

    const donnees: Prisma.UserUncheckedUpdateInput = {};
    if (dto.nom !== undefined) donnees.nom = dto.nom.trim();
    if (dto.prenom !== undefined) donnees.prenom = dto.prenom.trim();
    if (dto.profil !== undefined) donnees.profil = dto.profil;
    if (dto.entiteId !== undefined) donnees.entiteId = dto.entiteId;
    if (dto.actif !== undefined) donnees.actif = dto.actif;

    const fermerSessions = (dto.actif === false && avant.actif) || (dto.profil !== undefined && dto.profil !== avant.profil);
    const apres = await this.repository.modifier(id, donnees, dto.modules, fermerSessions);

    await this.journal.ecrire({
      action: dto.actif === false && avant.actif ? 'UTILISATEUR_DESACTIVE' : 'UTILISATEUR_MODIFIE',
      message: `Compte de ${nomComplet(apres)} modifié${fermerSessions ? ' ; sessions fermées' : ''}.`,
      succes: true,
      userId: auteur.id,
      auteur: nomComplet(auteur),
      cible: id,
      details: {
        avant: { profil: avant.profil, actif: avant.actif, entiteId: avant.entite?.id ?? null, modules: avant.modules.map((m) => m.module) },
        apres: { profil: apres.profil, actif: apres.actif, entiteId: apres.entite?.id ?? null, modules: apres.modules.map((m) => m.module) },
      },
    });
    return fiche(apres);
  }

  /** Renvoie le lien d'activation, ou de nouveau mot de passe si le compte est déjà activé. */
  async renvoyerLien(id: string, auteur: UtilisateurConnecte): Promise<void> {
    const cible = await this.repository.trouver(id);
    if (!cible) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Compte introuvable.' });
    }
    if (!cible.actif) {
      throw new BadRequestException({ code: 'INACTIF', message: 'Le compte est désactivé : réactivez-le avant d’envoyer un lien.' });
    }
    if (cible.profil === 'SUPER_ADMINISTRATEUR' && auteur.profil !== 'SUPER_ADMINISTRATEUR') {
      throw new ForbiddenException({ code: 'SUPER_ADMIN', message: 'Seul un super administrateur peut agir sur un super administrateur.' });
    }
    await this.auth.demanderReinitialisation(cible.email, { adresseIp: null, navigateur: null }, auteur);
  }
}
