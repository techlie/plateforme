import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { CONFIGURATION } from '../configuration';
import type { Configuration } from '../configuration';

export interface Courriel {
  a: string;
  objet: string;
  texte: string;
}

/** Façon d'expédier un courriel. Remplacée par une boîte de test dans les tests. */
export abstract class TransportCourriel {
  abstract envoyer(courriel: Courriel): Promise<void>;
}

/** Envoi réel, par le serveur de messagerie déclaré dans la configuration. */
export class TransportSmtp extends TransportCourriel {
  private readonly transport: Transporter;

  constructor(private readonly configuration: Configuration) {
    super();
    const smtp = configuration.courriel.smtp!;
    this.transport = createTransport({
      host: smtp.hote,
      port: smtp.port,
      secure: smtp.securise,
      auth: smtp.utilisateur ? { user: smtp.utilisateur, pass: smtp.motDePasse } : undefined,
    });
  }

  async envoyer(courriel: Courriel): Promise<void> {
    await this.transport.sendMail({
      from: this.configuration.courriel.expediteur,
      to: courriel.a,
      subject: courriel.objet,
      text: courriel.texte,
    });
  }
}

/**
 * Sur un poste de développement sans serveur de messagerie, le courriel est écrit
 * dans la console du serveur. Jamais en production : la configuration l'interdit.
 */
export class TransportConsole extends TransportCourriel {
  private readonly logger = new Logger('Courriel');

  async envoyer(courriel: Courriel): Promise<void> {
    this.logger.log(`À ${courriel.a} · ${courriel.objet}\n${courriel.texte}`);
  }
}

export function creerTransport(configuration: Configuration): TransportCourriel {
  return configuration.courriel.smtp ? new TransportSmtp(configuration) : new TransportConsole();
}

/** Les courriels envoyés par la plateforme, tous signés SR CONSEIL. */
@Injectable()
export class CourrielService {
  constructor(
    private readonly transport: TransportCourriel,
    @Inject(CONFIGURATION) private readonly configuration: Configuration,
  ) {}

  envoyerCode(a: string, code: string, validiteMinutes: number): Promise<void> {
    return this.transport.envoyer({
      a,
      objet: `SR CONSEIL · votre code de connexion ${code}`,
      texte: [
        'Bonjour,',
        '',
        `Votre code de connexion à la plateforme SR CONSEIL : ${code}`,
        `Il est valable ${validiteMinutes} minutes et ne sert qu'une fois.`,
        '',
        "Si vous n'êtes pas à l'origine de cette demande, ne communiquez ce code à personne et prévenez le cabinet.",
        '',
        'SR CONSEIL',
      ].join('\n'),
    });
  }

  envoyerInvitation(a: string, prenom: string, jeton: string, validiteHeures: number): Promise<void> {
    const lien = `${this.configuration.urlApplication}/activation?jeton=${encodeURIComponent(jeton)}`;
    return this.transport.envoyer({
      a,
      objet: 'SR CONSEIL · votre accès à la plateforme',
      texte: [
        `Bonjour ${prenom},`,
        '',
        'Un accès à la plateforme SR CONSEIL vient de vous être ouvert.',
        'Pour le créer, choisissez votre mot de passe en suivant ce lien :',
        lien,
        '',
        `Le lien est valable ${validiteHeures} heures et ne sert qu'une fois.`,
        'À chaque connexion, un code vous sera ensuite envoyé à cette adresse.',
        '',
        'SR CONSEIL',
      ].join('\n'),
    });
  }

  envoyerReinitialisation(a: string, prenom: string, jeton: string, validiteMinutes: number): Promise<void> {
    const lien = `${this.configuration.urlApplication}/reinitialisation?jeton=${encodeURIComponent(jeton)}`;
    return this.transport.envoyer({
      a,
      objet: 'SR CONSEIL · nouveau mot de passe',
      texte: [
        `Bonjour ${prenom},`,
        '',
        'Pour choisir un nouveau mot de passe, suivez ce lien :',
        lien,
        '',
        `Le lien est valable ${validiteMinutes} minutes et ne sert qu'une fois.`,
        "Si vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable.",
        '',
        'SR CONSEIL',
      ].join('\n'),
    });
  }
}
