import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Profils, UtilisateurCourant } from '../../shared/acces/acces.decorateurs';
import { PROFILS_ADMINISTRATION } from '../../shared/acces/acces.types';
import type { UtilisateurConnecte } from '../../shared/acces/acces.types';
import { CreationEntiteDto, ModificationEntiteDto } from './dto/entites.dto';
import { EntitesService } from './entites.service';

@Controller('entites')
@Profils(...PROFILS_ADMINISTRATION)
export class EntitesController {
  constructor(private readonly service: EntitesService) {}

  @Get()
  lister() {
    return this.service.lister();
  }

  @Post()
  creer(@Body() dto: CreationEntiteDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.creer(dto, auteur);
  }

  @Patch(':id')
  modifier(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ModificationEntiteDto, @UtilisateurCourant() auteur: UtilisateurConnecte) {
    return this.service.modifier(id, dto, auteur);
  }
}
