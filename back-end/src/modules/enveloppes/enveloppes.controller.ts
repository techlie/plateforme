import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CategorieMotif } from '@prisma/client';
import type { Response } from 'express';
import { ModuleRequis, Profils, UtilisateurCourant } from '../../shared/acces/acces.decorateurs';
import { PROFILS_ADMINISTRATION } from '../../shared/acces/acces.types';
import type { UtilisateurConnecte } from '../../shared/acces/acces.types';
import { PROFILS_GESTION } from './acces-enveloppes';
import { DocumentsService, enTeteFichier, TAILLE_MAX_DOCUMENT } from '../../shared/documents/documents.service';
import type { FichierRecu } from '../../shared/documents/documents.service';
import { DepotDocumentEnveloppeDto } from './dto/documents.dto';
import {
  ClientConfieDto,
  EnveloppeDto,
  LiberationGlobaleDto,
  ModificationEnveloppeDto,
  ModificationMotifDto,
  MotifDto,
  MouvementDto,
  ParametresDto,
  ProlongationGlobaleDto,
  ReservationGlobaleDto,
  StatutProduitDto,
  UpfrontDto,
} from './dto/enveloppes.dto';
import { EnveloppesService } from './enveloppes.service';
import { ReservationsService } from './reservations.service';

@Controller('enveloppes')
@ModuleRequis('ENVELOPPES')
export class EnveloppesController {
  constructor(
    private readonly service: EnveloppesService,
    private readonly reservations: ReservationsService,
    private readonly documents: DocumentsService,
  ) {}

  // Paramètres et motifs

  @Get('parametres')
  @Profils(...PROFILS_GESTION)
  parametres() {
    return this.service.lireParametres();
  }

  @Patch('parametres')
  @Profils(...PROFILS_ADMINISTRATION)
  modifierParametres(@Body() dto: ParametresDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.modifierParametres(dto, u);
  }

  @Post('parametres/emailing')
  @Profils(...PROFILS_ADMINISTRATION)
  validerEmailing(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.validerEmailing(u);
  }

  @Get('motifs')
  motifs(@Query('categorie', new ParseEnumPipe(CategorieMotif, { optional: true })) categorie?: CategorieMotif) {
    return this.service.motifs(categorie);
  }

  @Post('motifs')
  @Profils(...PROFILS_ADMINISTRATION)
  creerMotif(@Body() dto: MotifDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.creerMotif(dto, u);
  }

  @Patch('motifs/:id')
  @Profils(...PROFILS_ADMINISTRATION)
  modifierMotif(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ModificationMotifDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.modifierMotif(id, dto, u);
  }

  // Clients confiés, fiabilité, réservations globales, documents

  @Get('clients-confies')
  clientsConfies(@UtilisateurCourant() u: UtilisateurConnecte, @Query('enveloppe') enveloppeId?: string) {
    return this.service.clientsConfies(u, enveloppeId || undefined);
  }

  @Post('clients-confies/:id/retrait')
  @HttpCode(204)
  @Profils(...PROFILS_ADMINISTRATION)
  retirerConfie(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.retirerConfie(id, u);
  }

  @Get('fiabilite')
  fiabilite(@UtilisateurCourant() u: UtilisateurConnecte, @Query('apporteur') apporteurId?: string) {
    return this.reservations.fiabilite(u, apporteurId || undefined);
  }

  @Post('globales/:id/liberation')
  @Profils(...PROFILS_GESTION)
  libererGlobale(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: LiberationGlobaleDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.libererGlobale(id, dto, u);
  }

  @Post('globales/:id/prolongation')
  @Profils(...PROFILS_GESTION)
  prolongerGlobale(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ProlongationGlobaleDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.prolongerGlobale(id, dto, u);
  }

  @Get('documents/:id')
  async document(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte, @Res({ passthrough: true }) res: Response) {
    const doc = await this.documents.lire(id, u);
    res.set({ 'Content-Type': doc.typeMime, 'Content-Disposition': enTeteFichier(doc.nom), 'Cache-Control': 'no-store' });
    return new StreamableFile(doc.contenu);
  }

  // Enveloppes

  @Get()
  lister(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.lister(u);
  }

  @Post()
  @Profils(...PROFILS_GESTION)
  creer(@Body() dto: EnveloppeDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.creer(dto, u);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.detail(id, u);
  }

  @Patch(':id')
  @Profils(...PROFILS_GESTION)
  modifier(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ModificationEnveloppeDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.modifier(id, dto, u);
  }

  @Post(':id/ouverture')
  @Profils(...PROFILS_GESTION)
  ouvrir(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.ouvrir(id, u);
  }

  @Post(':id/cloture')
  @Profils(...PROFILS_GESTION)
  cloturer(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.cloturer(id, u);
  }

  @Post(':id/statut-produit')
  @Profils(...PROFILS_ADMINISTRATION)
  statutProduit(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: StatutProduitDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.statutProduit(id, dto, u);
  }

  @Post(':id/mouvements')
  @Profils(...PROFILS_ADMINISTRATION)
  mouvement(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: MouvementDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.mouvement(id, dto, u);
  }

  @Put(':id/upfront')
  @Profils('SUPER_ADMINISTRATEUR')
  upfront(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpfrontDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.upfront(id, dto, u);
  }

  @Post(':id/globales')
  @Profils(...PROFILS_GESTION)
  creerGlobale(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReservationGlobaleDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.creerGlobale(id, dto, u);
  }

  /** Réservations globales actives d'un apporteur, sources possibles d'une saisie. */
  @Get(':id/globales-disponibles')
  async globalesDisponibles(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte, @Query('apporteur') apporteurId?: string) {
    return this.reservations.globalesDisponibles(id, u, apporteurId || undefined);
  }

  @Post(':id/clients-confies')
  @Profils(...PROFILS_ADMINISTRATION)
  confier(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ClientConfieDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.confier(id, dto, u);
  }

  @Get(':id/liste-attente')
  @Profils(...PROFILS_GESTION)
  listeAttente(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.reservations.listeAttente(id, u);
  }

  @Post(':id/documents')
  @Profils(...PROFILS_GESTION)
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_DOCUMENT, files: 1 } }))
  deposer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DepotDocumentEnveloppeDto,
    @UploadedFile() fichier: FichierRecu | undefined,
    @UtilisateurCourant() u: UtilisateurConnecte,
  ) {
    return this.service.enveloppe(id).then(() => this.documents.deposer(fichier, dto.categorie, { enveloppeId: id }, u));
  }
}
