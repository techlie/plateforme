import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ModuleRequis, Profils, UtilisateurCourant } from '../../shared/acces/acces.decorateurs';
import { PROFILS_ADMINISTRATION } from '../../shared/acces/acces.types';
import type { UtilisateurConnecte } from '../../shared/acces/acces.types';
import { estGestion, PROFILS_GESTION } from './acces-enveloppes';
import { DocumentsService, TAILLE_MAX_DOCUMENT } from './documents.service';
import type { FichierRecu } from './documents.service';
import { DepotDocumentReservationDto } from './dto/documents.dto';
import {
  AnnulationDto,
  DecisionDto,
  DeclarationOperationDto,
  EntiteReservationDto,
  FiltreReservationsDto,
  JustificationEcartDto,
  ModificationReservationDto,
  PatrimoineDto,
  ReservationDto,
  ServiceAttenteDto,
  TauxDto,
  TraitementEcheanceDto,
  VerificationDto,
} from './dto/reservations.dto';
import { enTeteFichier } from './enveloppes.controller';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
@ModuleRequis('ENVELOPPES')
export class ReservationsController {
  constructor(
    private readonly service: ReservationsService,
    private readonly documents: DocumentsService,
  ) {}

  /** Contrôles et calculs affichés avant l'envoi, sans rien enregistrer. */
  @Post('apercu')
  apercu(@Body() dto: ReservationDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.apercu(dto, u);
  }

  @Post()
  creer(@Body() dto: ReservationDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.creer(dto, u);
  }

  @Get()
  lister(@Query() filtre: FiltreReservationsDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.lister(filtre, u);
  }

  @Get('export')
  async exporter(@Query() filtre: FiltreReservationsDto, @UtilisateurCourant() u: UtilisateurConnecte, @Res({ passthrough: true }) res: Response) {
    const csv = await this.service.exporter(filtre, u);
    const jour = new Date().toISOString().slice(0, 10);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': enTeteFichier(`reservations-${jour}.csv`), 'Cache-Control': 'no-store' });
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.detail(id, u);
  }

  @Patch(':id')
  modifier(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ModificationReservationDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.modifier(id, dto, u);
  }

  @Post(':id/validation')
  @Profils(...PROFILS_GESTION)
  valider(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.valider(id, u);
  }

  @Post(':id/refus')
  @Profils(...PROFILS_GESTION)
  refuser(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: DecisionDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.refuser(id, dto, u);
  }

  @Post(':id/renvoi')
  @Profils(...PROFILS_GESTION)
  renvoyer(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: DecisionDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.renvoyer(id, dto, u);
  }

  @Post(':id/annulation')
  annuler(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AnnulationDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.annuler(id, dto, u);
  }

  @Post(':id/accord-client')
  accordClient(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.accordClient(id, u);
  }

  @Get(':id/avenant')
  async avenant(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() u: UtilisateurConnecte, @Res({ passthrough: true }) res: Response) {
    const fiche = await this.service.ficheAvenant(id, u);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': enTeteFichier(fiche.nom), 'Cache-Control': 'no-store' });
    return new StreamableFile(Buffer.from(fiche.contenu));
  }

  @Post(':id/patrimoine')
  patrimoine(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: PatrimoineDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.patrimoine(id, dto, u);
  }

  @Post(':id/operation')
  declarerOperation(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: DeclarationOperationDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.declarerOperation(id, dto, u);
  }

  @Post(':id/verification')
  @Profils(...PROFILS_GESTION)
  verifier(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: VerificationDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.verifier(id, dto, u);
  }

  @Post(':id/justification-ecart')
  @Profils(...PROFILS_GESTION)
  justifierEcart(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: JustificationEcartDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.justifierEcart(id, dto, u);
  }

  @Post(':id/prolongation')
  @Profils(...PROFILS_GESTION)
  prolonger(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: TraitementEcheanceDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.prolonger(id, dto, u);
  }

  @Post(':id/liberation')
  @Profils(...PROFILS_GESTION)
  liberer(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: TraitementEcheanceDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.liberer(id, dto, u);
  }

  @Post(':id/annulation-apres-operation')
  @Profils(...PROFILS_GESTION)
  annulerApresOperation(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: DecisionDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.annulerApresOperation(id, dto, u);
  }

  @Post(':id/service')
  @Profils(...PROFILS_GESTION)
  servir(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ServiceAttenteDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.servir(id, dto, u);
  }

  @Post(':id/taux')
  @Profils(...PROFILS_ADMINISTRATION)
  taux(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: TauxDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.modifierTaux(id, dto, u);
  }

  @Post(':id/entite')
  @Profils(...PROFILS_GESTION)
  entite(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: EntiteReservationDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.service.modifierEntite(id, dto, u);
  }

  /**
   * Justificatif d'opération (apporteur ou back-office) ; preuve de vérification (back-office,
   * jamais sur sa propre réservation).
   */
  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_DOCUMENT, files: 1 } }))
  async deposer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DepotDocumentReservationDto,
    @UploadedFile() fichier: FichierRecu | undefined,
    @UtilisateurCourant() u: UtilisateurConnecte,
  ) {
    const r = await this.service.detail(id, u);
    if (dto.categorie === 'PREUVE_VERIFICATION' && !(estGestion(u) && r.droits.decider)) {
      throw new ForbiddenException({ code: 'PROFIL', message: 'La preuve de vérification est déposée par le back-office, jamais sur sa propre réservation.' });
    }
    return this.documents.deposer(fichier, dto.categorie, { reservationId: id }, u);
  }
}
