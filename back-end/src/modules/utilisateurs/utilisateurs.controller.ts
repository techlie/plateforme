import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Profils, UtilisateurCourant } from '../../shared/acces/acces.decorateurs';
import { PROFILS_ADMINISTRATION } from '../../shared/acces/acces.types';
import type { UtilisateurConnecte } from '../../shared/acces/acces.types';
import { CreationUtilisateurDto, ModificationUtilisateurDto } from './dto/utilisateurs.dto';
import type { FicheUtilisateur } from './dto/utilisateurs.reponses';
import { UtilisateursService } from './utilisateurs.service';

@Controller('utilisateurs')
@Profils(...PROFILS_ADMINISTRATION)
export class UtilisateursController {
  constructor(private readonly service: UtilisateursService) {}

  @Get()
  lister(): Promise<FicheUtilisateur[]> {
    return this.service.lister();
  }

  @Post()
  creer(@Body() dto: CreationUtilisateurDto, @UtilisateurCourant() auteur: UtilisateurConnecte): Promise<FicheUtilisateur> {
    return this.service.creer(dto, auteur);
  }

  @Patch(':id')
  modifier(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ModificationUtilisateurDto,
    @UtilisateurCourant() auteur: UtilisateurConnecte,
  ): Promise<FicheUtilisateur> {
    return this.service.modifier(id, dto, auteur);
  }

  @Post(':id/lien')
  @HttpCode(204)
  renvoyerLien(@Param('id', new ParseUUIDPipe()) id: string, @UtilisateurCourant() auteur: UtilisateurConnecte): Promise<void> {
    return this.service.renvoyerLien(id, auteur);
  }
}
