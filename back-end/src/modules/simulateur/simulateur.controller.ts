import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ModuleRequis } from '../../shared/acces/acces.decorateurs';
import { CalculCommissionDto } from './dto/calcul-commission.dto';
import type { CatalogueSimulateur, ResultatSimulation } from './dto/simulateur.reponses';
import { SimulateurService } from './simulateur.service';

/** Date du jour au format AAAA-MM-JJ, à l'heure de Paris. */
function aujourdhui(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

@Controller('simulateur')
@ModuleRequis('SIMULATEUR')
export class SimulateurController {
  constructor(private readonly service: SimulateurService) {}

  @Get('contrats')
  catalogue(): CatalogueSimulateur {
    return this.service.catalogue(aujourdhui());
  }

  @Post('calcul')
  @HttpCode(200)
  calculer(@Body() demande: CalculCommissionDto): ResultatSimulation {
    return this.service.simuler(demande, aujourdhui());
  }
}
