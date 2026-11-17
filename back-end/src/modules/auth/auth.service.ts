import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { modulesEffectifs, nomComplet, UtilisateurConnecte } from '../../shared/acces/acces.types';
import { CONFIGURATION } from '../../shared/configuration';
import type { Configuration } from '../../shared/configuration';
import { CourrielService } from '../../shared/courriel/courriel.service';
import { JournalService } from '../../shared/journal/journal.service';
import {
  empreinteCode,
  empreintesEgales,
  empreinteJeton,
  genererCode,
  genererJeton,
  masquerAdresse,
  normaliserAdresse,
} from '../../shared/securite/securite';
import { AuthRepository, UtilisateurAvecDroits } from './auth.repository';
import type { ProfilConnecte, ReponseConnexion } from './dto/auth.reponses';

/** Règles de la connexion. Elles sont fixes et visibles ici plutôt que dispersées. */
export const REGLES_CONNEXION = {
  /** Mots de passe faux d'affilée avant blocage du compte. */
  echecsAvantBlocage: 5,
  blocageMinutes: 15,
  codeValiditeMinutes: 10,
  /** Codes faux acceptés sur une même demande avant qu'elle ne soit annulée. */
  tentativesCode: 5,
  invitationValiditeHeures: 72,
  reinitialisationValiditeMinutes: 60,
  /** Coût du hachage des mots de passe. */
  coutHachage: 12,
} as const;

/** Empreinte d'un mot de passe qui n'existe pas : la vérification prend le même temps qu'un compte réel. */
const EMPREINTE_FACTICE = bcrypt.hashSync('mot-de-passe-factice-pour-egaliser-le-temps', 10);

const MESSAGE_IDENTIFIANTS = 'Adresse ou mot de passe incorrect.';
const MESSAGE_CODE_PERIME = 'Ce code a expiré ou a déjà servi. Recommencez la connexion.';

interface Origine {
  adresseIp: string | null;
  navigateur: string | null;
}

function minutes(n: number): number {
  return n * 60_000;
}

export function profilConnecte(u: UtilisateurAvecDroits): ProfilConnecte {
  return {
    id: u.id,
    email: u.email,
    nom: u.nom,
    prenom: u.prenom,
    profil: u.profil,
    modules: modulesEffectifs(
      u.profil,
      u.modules.map((m) => m.module),
    ),
    entite: u.entite,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly courriel: CourrielService,
    private readonly journal: JournalService,
    @Inject(CONFIGURATION) private readonly configuration: Configuration,
  ) {}

  /** Première étape : mot de passe. Si tout est bon, un code part par courriel. */
  async connexion(emailSaisi: string, motDePasse: string, origine: Origine): Promise<ReponseConnexion> {
    const email = normaliserAdresse(emailSaisi);
    const maintenant = new Date();
    const utilisateur = await this.repository.trouverParEmail(email);

    if (!utilisateur || !utilisateur.actif || !utilisateur.motDePasse) {
      await bcrypt.compare(motDePasse, EMPREINTE_FACTICE);
      await this.journal.ecrire({
        action: 'CONNEXION_REFUSEE',
        message: utilisateur ? 'Compte inactif ou non activé.' : 'Adresse inconnue.',
        succes: false,
        userId: utilisateur?.id,
        details: { email },
        ...origine,
      });
      throw new UnauthorizedException({ code: 'IDENTIFIANTS', message: MESSAGE_IDENTIFIANTS });
    }

    if (utilisateur.bloqueJusqua && utilisateur.bloqueJusqua > maintenant) {
      await this.journal.ecrire({
        action: 'CONNEXION_REFUSEE',
        message: 'Compte bloqué temporairement après plusieurs essais.',
        succes: false,
        userId: utilisateur.id,
        auteur: nomComplet(utilisateur),
        ...origine,
      });
      throw new HttpException(
        { code: 'BLOQUE', message: 'Trop de tentatives. Réessayez dans quelques minutes.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const bon = await bcrypt.compare(motDePasse, utilisateur.motDePasse);
    if (!bon) {
      const echecs = utilisateur.echecsConnexion + 1;
      const bloque = echecs >= REGLES_CONNEXION.echecsAvantBlocage;
      await this.repository.enregistrerEchec(
        utilisateur.id,
        bloque ? 0 : echecs,
        bloque ? new Date(maintenant.getTime() + minutes(REGLES_CONNEXION.blocageMinutes)) : null,
      );
      await this.journal.ecrire({
        action: bloque ? 'COMPTE_BLOQUE' : 'CONNEXION_REFUSEE',
        message: bloque
          ? `Mot de passe faux ${REGLES_CONNEXION.echecsAvantBlocage} fois : compte bloqué ${REGLES_CONNEXION.blocageMinutes} minutes.`
          : 'Mot de passe faux.',
        succes: false,
        userId: utilisateur.id,
        auteur: nomComplet(utilisateur),
        ...origine,
      });
      throw new UnauthorizedException({ code: 'IDENTIFIANTS', message: MESSAGE_IDENTIFIANTS });
    }

    if (utilisateur.echecsConnexion > 0 || utilisateur.bloqueJusqua) {
      await this.repository.remettreAZeroEchecs(utilisateur.id);
    }

    const code = genererCode();
    const demande = await this.repository.creerCode(
      utilisateur.id,
      empreinteCode(code, this.configuration.cleSecrete),
      new Date(maintenant.getTime() + minutes(REGLES_CONNEXION.codeValiditeMinutes)),
      maintenant,
    );
    await this.courriel.envoyerCode(utilisateur.email, code, REGLES_CONNEXION.codeValiditeMinutes);
    await this.journal.ecrire({
      action: 'CODE_ENVOYE',
      message: 'Mot de passe correct, code de connexion envoyé par courriel.',
      succes: true,
      userId: utilisateur.id,
      auteur: nomComplet(utilisateur),
      ...origine,
    });

    return {
      etape: 'CODE',
      demande: demande.id,
      adresseMasquee: masquerAdresse(utilisateur.email),
      validiteMinutes: REGLES_CONNEXION.codeValiditeMinutes,
    };
  }

  /** Deuxième étape : le code reçu par courriel. Ouvre la session. */
  async validerCode(
    demandeId: string,
    code: string,
    origine: Origine,
  ): Promise<{ jeton: string; expireLe: Date; utilisateur: ProfilConnecte }> {
    const maintenant = new Date();
    const demande = await this.repository.trouverCode(demandeId);

    if (
      !demande ||
      demande.utiliseLe ||
      demande.expireLe <= maintenant ||
      demande.tentatives >= REGLES_CONNEXION.tentativesCode ||
      !demande.user.actif
    ) {
      throw new UnauthorizedException({ code: 'CODE_PERIME', message: MESSAGE_CODE_PERIME });
    }

    const utilisateur = demande.user;
    if (!empreintesEgales(empreinteCode(code, this.configuration.cleSecrete), demande.empreinte)) {
      const tentatives = demande.tentatives + 1;
      const epuise = tentatives >= REGLES_CONNEXION.tentativesCode;
      await this.repository.compterTentative(demande.id, tentatives, epuise ? maintenant : null);
      await this.journal.ecrire({
        action: 'CODE_REFUSE',
        message: epuise ? 'Code faux trop de fois : demande annulée.' : 'Code faux.',
        succes: false,
        userId: utilisateur.id,
        auteur: nomComplet(utilisateur),
        ...origine,
      });
      throw new UnauthorizedException(
        epuise
          ? { code: 'CODE_PERIME', message: 'Trop de codes faux. Recommencez la connexion.' }
          : { code: 'CODE_FAUX', message: 'Code incorrect. Vérifiez le dernier courriel reçu.' },
      );
    }

    if (!(await this.repository.consommerCode(demande.id, maintenant))) {
      throw new UnauthorizedException({ code: 'CODE_PERIME', message: MESSAGE_CODE_PERIME });
    }

    const jeton = genererJeton();
    const expireLe = new Date(maintenant.getTime() + this.configuration.session.dureeHeures * 3_600_000);
    await this.repository.creerSession({
      userId: utilisateur.id,
      empreinteJeton: empreinteJeton(jeton),
      expireLe,
      maintenant,
      ...origine,
    });
    await this.journal.ecrire({
      action: 'CONNEXION',
      message: 'Connexion réussie après le code reçu par courriel.',
      succes: true,
      userId: utilisateur.id,
      auteur: nomComplet(utilisateur),
      ...origine,
    });

    return { jeton, expireLe, utilisateur: profilConnecte(utilisateur) };
  }

  /** Vérifie le jeton de session d'une demande. Renvoie null si la session n'est plus valable. */
  async utilisateurDeSession(jeton: string): Promise<UtilisateurConnecte | null> {
    const maintenant = new Date();
    const session = await this.repository.trouverSession(empreinteJeton(jeton));
    if (!session || session.revoqueeLe || session.expireLe <= maintenant || !session.user.actif) {
      return null;
    }
    const inactivite = minutes(this.configuration.session.inactiviteMinutes);
    if (maintenant.getTime() - session.derniereActivite.getTime() > inactivite) {
      await this.repository.revoquerSession(session.id, maintenant);
      return null;
    }
    if (maintenant.getTime() - session.derniereActivite.getTime() > 60_000) {
      await this.repository.noterActivite(session.id, maintenant);
    }
    return { ...profilConnecte(session.user), sessionId: session.id };
  }

  async deconnexion(utilisateur: UtilisateurConnecte, origine: Origine): Promise<void> {
    await this.repository.revoquerSession(utilisateur.sessionId, new Date());
    await this.journal.ecrire({
      action: 'DECONNEXION',
      message: 'Déconnexion.',
      succes: true,
      userId: utilisateur.id,
      auteur: nomComplet(utilisateur),
      ...origine,
    });
  }

  /**
   * Mot de passe oublié, ou lien envoyé par un administrateur (envoyePar).
   * La réponse est la même que l'adresse existe ou non.
   */
  async demanderReinitialisation(
    emailSaisi: string,
    origine: Origine,
    envoyePar?: { id: string; prenom: string; nom: string },
  ): Promise<void> {
    const email = normaliserAdresse(emailSaisi);
    const utilisateur = await this.repository.trouverParEmail(email);
    if (!utilisateur || !utilisateur.actif) {
      await this.journal.ecrire({
        action: 'REINITIALISATION_REFUSEE',
        message: 'Demande pour une adresse inconnue ou un compte inactif.',
        succes: false,
        userId: utilisateur?.id,
        details: { email },
        ...origine,
      });
      return;
    }
    const maintenant = new Date();
    const jeton = genererJeton();
    const activation = !utilisateur.motDePasse;
    const validiteMinutes = activation
      ? REGLES_CONNEXION.invitationValiditeHeures * 60
      : REGLES_CONNEXION.reinitialisationValiditeMinutes;
    await this.repository.creerJeton(
      utilisateur.id,
      empreinteJeton(jeton),
      activation ? 'ACTIVATION' : 'REINITIALISATION',
      new Date(maintenant.getTime() + minutes(validiteMinutes)),
      maintenant,
    );
    if (activation) {
      await this.courriel.envoyerInvitation(utilisateur.email, utilisateur.prenom, jeton, REGLES_CONNEXION.invitationValiditeHeures);
    } else {
      await this.courriel.envoyerReinitialisation(utilisateur.email, utilisateur.prenom, jeton, validiteMinutes);
    }
    await this.journal.ecrire({
      action: envoyePar ? 'LIEN_ENVOYE' : 'REINITIALISATION_DEMANDEE',
      message: `${activation ? "Lien d'activation" : 'Lien de nouveau mot de passe'} envoyé à ${nomComplet(utilisateur)}.`,
      succes: true,
      userId: envoyePar?.id ?? utilisateur.id,
      auteur: nomComplet(envoyePar ?? utilisateur),
      cible: utilisateur.id,
      ...origine,
    });
  }

  /** Vérifie qu'un lien reçu par courriel est encore valable, avant d'afficher le formulaire. */
  async verifierJeton(jeton: string): Promise<{ motif: 'ACTIVATION' | 'REINITIALISATION'; prenom: string }> {
    const trouve = await this.repository.trouverJeton(empreinteJeton(jeton));
    if (!trouve || trouve.utiliseLe || trouve.expireLe <= new Date() || !trouve.user.actif) {
      throw new UnauthorizedException({
        code: 'LIEN_PERIME',
        message: "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau depuis l'écran de connexion.",
      });
    }
    return { motif: trouve.motif, prenom: trouve.user.prenom };
  }

  /** Activation du compte ou nouveau mot de passe. Ferme toutes les sessions ouvertes. */
  async definirMotDePasse(jeton: string, motDePasse: string, origine: Origine): Promise<void> {
    const maintenant = new Date();
    const trouve = await this.repository.trouverJeton(empreinteJeton(jeton));
    if (!trouve || trouve.utiliseLe || trouve.expireLe <= maintenant || !trouve.user.actif) {
      throw new UnauthorizedException({
        code: 'LIEN_PERIME',
        message: "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau depuis l'écran de connexion.",
      });
    }
    const empreinte = await bcrypt.hash(motDePasse, REGLES_CONNEXION.coutHachage);
    const fait = await this.repository.definirMotDePasse(trouve.id, trouve.userId, empreinte, maintenant);
    if (!fait) {
      throw new UnauthorizedException({ code: 'LIEN_PERIME', message: 'Ce lien a déjà servi.' });
    }
    await this.journal.ecrire({
      action: trouve.motif === 'ACTIVATION' ? 'COMPTE_ACTIVE' : 'MOT_DE_PASSE_CHANGE',
      message: trouve.motif === 'ACTIVATION' ? 'Compte activé.' : 'Nouveau mot de passe choisi ; sessions fermées.',
      succes: true,
      userId: trouve.userId,
      auteur: nomComplet(trouve.user),
      ...origine,
    });
  }
}
