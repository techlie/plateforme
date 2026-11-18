import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ModuleOuAdministration, Profils, UtilisateurCourant } from '../../shared/acces/acces.decorateurs';
import { PROFILS_ADMINISTRATION } from '../../shared/acces/acces.types';
import type { UtilisateurConnecte } from '../../shared/acces/acces.types';
import { DocumentsService, enTeteFichier, TAILLE_MAX_DOCUMENT } from '../../shared/documents/documents.service';
import type { FichierRecu } from '../../shared/documents/documents.service';
import {
  ApporteurDto,
  CodeApporteurDto,
  CompagnieDto,
  ConventionDto,
  FondsDto,
  GammeDto,
  ImportFondsDto,
  ModificationApporteurDto,
  ModificationCodeApporteurDto,
  ModificationCompagnieDto,
  ModificationGammeDto,
} from './dto/referentiels.dto';
import { ReferentielsService } from './referentiels.service';

const PROFILS_GESTION = [...PROFILS_ADMINISTRATION, 'BACK_OFFICE' as const];

/** Lecture : comptes du module Enveloppes et administrateurs. Écriture : administrateurs. */
@Controller('referentiels')
@ModuleOuAdministration('ENVELOPPES')
export class ReferentielsController {
  constructor(
    private readonly service: ReferentielsService,
    private readonly documents: DocumentsService,
  ) {}

  @Get('compagnies')
  listerCompagnies() {
    return this.service.listerCompagnies();
  }

  @Post('compagnies')
  @Profils(...PROFILS_ADMINISTRATION)
  creerCompagnie(@Body() dto: CompagnieDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.creerCompagnie(dto, auteur);
  }

  @Patch('compagnies/:id')
  @Profils(...PROFILS_ADMINISTRATION)
  modifierCompagnie(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ModificationCompagnieDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.modifierCompagnie(id, dto, auteur);
  }

  @Post('compagnies/:id/gammes')
  @Profils(...PROFILS_ADMINISTRATION)
  ajouterGamme(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: GammeDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.ajouterGamme(id, dto, auteur);
  }

  @Patch('gammes/:id')
  @Profils(...PROFILS_ADMINISTRATION)
  modifierGamme(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ModificationGammeDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.modifierGamme(id, dto, auteur);
  }

  /** L'apporteur rattaché au compte connecté, avec ses codes. */
  @Get('apporteurs/moi')
  moi(@UtilisateurCourant() utilisateur: UtilisateurConnecte) {
    return this.service.apporteurDeCompte(utilisateur.id);
  }

  /** Les conventions de l'apporteur connecté, pour les consulter. */
  @Get('conventions/miennes')
  mesConventions(@UtilisateurCourant() utilisateur: UtilisateurConnecte) {
    return this.service.conventionsDeCompte(utilisateur.id);
  }

  /** Le document d'une convention : administrateurs et apporteur concerné (contrôle côté serveur). « ?voir=1 » l'affiche. */
  @Get('conventions/documents/:id')
  async documentConvention(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('voir') voir: string | undefined,
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Res({ passthrough: true }) res: Response,
  ) {
    const doc = await this.documents.lire(id, u);
    res.set({
      'Content-Type': doc.typeMime,
      'Content-Disposition': enTeteFichier(doc.nom, voir === '1' ? 'inline' : 'attachment'),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(doc.contenu);
  }

  @Get('apporteurs/:id/conventions')
  @Profils(...PROFILS_ADMINISTRATION)
  conventions(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.conventions(id);
  }

  @Post('apporteurs/:id/conventions')
  @Profils(...PROFILS_ADMINISTRATION)
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_DOCUMENT, files: 1 } }))
  ajouterConvention(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConventionDto,
    @UploadedFile() fichier: FichierRecu | undefined,
    @UtilisateurCourant() auteur: UtilisateurConnecte,
  ) {
    return this.service.ajouterConvention(id, dto, fichier, auteur);
  }

  @Get('apporteurs')
  @Profils(...PROFILS_GESTION)
  listerApporteurs() {
    return this.service.listerApporteurs();
  }

  @Post('apporteurs')
  @Profils(...PROFILS_ADMINISTRATION)
  creerApporteur(@Body() dto: ApporteurDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.creerApporteur(dto, auteur);
  }

  @Patch('apporteurs/:id')
  @Profils(...PROFILS_ADMINISTRATION)
  modifierApporteur(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ModificationApporteurDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.modifierApporteur(id, dto, auteur);
  }

  /** Codes qu'un apporteur peut utiliser aujourd'hui chez une compagnie. Le mandataire ne voit que les siens. */
  @Get('codes-valables')
  async codesValables(
    @Query('compagnie', new ParseUUIDPipe()) compagnieId: string,
    @Query('apporteur') apporteurId: string | undefined,
    @UtilisateurCourant() utilisateur: UtilisateurConnecte,
  ) {
    const gestion = PROFILS_GESTION.includes(utilisateur.profil as (typeof PROFILS_GESTION)[number]);
    const cible = gestion && apporteurId ? apporteurId : (await this.service.apporteurDeCompte(utilisateur.id))?.id;
    return cible ? this.service.codesValables(cible, compagnieId, new Date()) : [];
  }

  @Get('codes')
  @Profils(...PROFILS_GESTION)
  listerCodes(@Query('compagnie') compagnieId?: string) {
    return this.service.listerCodes(compagnieId || undefined);
  }

  @Post('codes')
  @Profils(...PROFILS_ADMINISTRATION)
  creerCode(@Body() dto: CodeApporteurDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.creerCode(dto, auteur);
  }

  @Patch('codes/:id')
  @Profils(...PROFILS_ADMINISTRATION)
  modifierCode(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ModificationCodeApporteurDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.modifierCode(id, dto, auteur);
  }

  @Get('fonds')
  listerFonds(@Query('compagnie', new ParseUUIDPipe()) compagnieId: string) {
    return this.service.listerFonds(compagnieId);
  }

  /** Le back-office ajoute un fonds vérifié, saisi « hors référentiel » sur une réservation. */
  @Post('fonds')
  @Profils(...PROFILS_GESTION)
  ajouterFonds(@Body() dto: FondsDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.ajouterFonds(dto, auteur);
  }

  @Post('fonds/import')
  @Profils(...PROFILS_ADMINISTRATION)
  importerFonds(@Body() dto: ImportFondsDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.importerFonds(dto, auteur);
  }
}
