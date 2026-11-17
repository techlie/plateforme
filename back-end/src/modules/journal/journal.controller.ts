import { Controller, Get, Query } from '@nestjs/common';
import { Profils } from '../../shared/acces/acces.decorateurs';
import { PROFILS_ADMINISTRATION } from '../../shared/acces/acces.types';
import { RechercheJournalDto } from './dto/journal.dto';
import { JournalLectureService } from './journal.service';

@Controller('journal')
@Profils(...PROFILS_ADMINISTRATION)
export class JournalController {
  constructor(private readonly service: JournalLectureService) {}

  @Get()
  rechercher(@Query() dto: RechercheJournalDto) {
    return this.service.rechercher(dto);
  }
}
