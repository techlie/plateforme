import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public, UtilisateurCourant } from '../../shared/acces/acces.decorateurs';
import type { UtilisateurConnecte } from '../../shared/acces/acces.types';
import { lireCookie, NOM_COOKIE_APPAREIL, NOM_COOKIE_SESSION, origineDemande } from '../../shared/acces/requete';
import { CONFIGURATION } from '../../shared/configuration';
import type { Configuration } from '../../shared/configuration';
import { AuthService } from './auth.service';
import { CodeDto, ConnexionDto, DefinitionMotDePasseDto, DemandeReinitialisationDto, JetonDto } from './dto/auth.dto';
import type { ProfilConnecte, ReponseConnexion } from './dto/auth.reponses';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIGURATION) private readonly configuration: Configuration,
  ) {}

  @Public()
  @Post('connexion')
  @HttpCode(200)
  async connexion(@Body() dto: ConnexionDto, @Req() requete: Request, @Res({ passthrough: true }) reponse: Response): Promise<ReponseConnexion> {
    const resultat = await this.auth.connexion(dto.email, dto.motDePasse, origineDemande(requete), lireCookie(requete, NOM_COOKIE_APPAREIL));
    if (resultat.etape === 'CONNECTE' && 'jeton' in resultat) {
      this.poserSession(reponse, resultat.jeton, resultat.expireLe);
      return { etape: 'CONNECTE', utilisateur: resultat.utilisateur };
    }
    return resultat;
  }

  private poserSession(reponse: Response, jeton: string, expireLe: Date): void {
    // Le jeton de session reste dans un cookie illisible par le code de la page.
    reponse.cookie(NOM_COOKIE_SESSION, jeton, {
      httpOnly: true,
      secure: this.configuration.production,
      sameSite: 'strict',
      path: '/api',
      expires: expireLe,
    });
  }

  @Public()
  @Post('code')
  @HttpCode(200)
  async code(
    @Body() dto: CodeDto,
    @Req() requete: Request,
    @Res({ passthrough: true }) reponse: Response,
  ): Promise<ProfilConnecte> {
    const resultat = await this.auth.validerCode(dto.demande, dto.code, origineDemande(requete), dto.faireConfiance ?? false);
    this.poserSession(reponse, resultat.jeton, resultat.expireLe);
    if (resultat.appareil) {
      // Appareil reconnu : cookie limité aux routes de connexion, sans valeur sans le mot de passe.
      reponse.cookie(NOM_COOKIE_APPAREIL, resultat.appareil.jeton, {
        httpOnly: true,
        secure: this.configuration.production,
        sameSite: 'strict',
        path: '/api/auth',
        expires: resultat.appareil.expireLe,
      });
    }
    return resultat.utilisateur;
  }

  @Get('moi')
  moi(@UtilisateurCourant() utilisateur: UtilisateurConnecte): ProfilConnecte {
    const { sessionId: _session, ...profil } = utilisateur;
    return profil;
  }

  @Post('deconnexion')
  @HttpCode(204)
  async deconnexion(
    @UtilisateurCourant() utilisateur: UtilisateurConnecte,
    @Req() requete: Request,
    @Res({ passthrough: true }) reponse: Response,
  ): Promise<void> {
    await this.auth.deconnexion(utilisateur, origineDemande(requete));
    reponse.clearCookie(NOM_COOKIE_SESSION, { path: '/api' });
  }

  @Public()
  @Post('mot-de-passe-oublie')
  @HttpCode(200)
  async motDePasseOublie(@Body() dto: DemandeReinitialisationDto, @Req() requete: Request): Promise<{ message: string }> {
    await this.auth.demanderReinitialisation(dto.email, origineDemande(requete));
    return {
      message: 'Si cette adresse correspond à un compte actif, un lien vient de lui être envoyé.',
    };
  }

  @Public()
  @Post('lien')
  @HttpCode(200)
  verifierLien(@Body() dto: JetonDto) {
    return this.auth.verifierJeton(dto.jeton);
  }

  @Public()
  @Post('mot-de-passe')
  @HttpCode(204)
  definirMotDePasse(@Body() dto: DefinitionMotDePasseDto, @Req() requete: Request): Promise<void> {
    return this.auth.definirMotDePasse(dto.jeton, dto.motDePasse, origineDemande(requete));
  }
}
