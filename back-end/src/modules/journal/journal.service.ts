import { Injectable } from '@nestjs/common';
import { RechercheJournalDto } from './dto/journal.dto';
import { JournalRepository } from './journal.repository';

/** Lecture du journal par les administrateurs. L'écriture passe par le service partagé. */
@Injectable()
export class JournalLectureService {
  constructor(private readonly repository: JournalRepository) {}

  async rechercher(dto: RechercheJournalDto) {
    const page = dto.page ?? 1;
    const parPage = dto.parPage ?? 50;
    const resultat = await this.repository.rechercher(
      { action: dto.action || undefined, userId: dto.utilisateur || undefined },
      page,
      parPage,
    );
    return { page, parPage, total: resultat.total, lignes: resultat.lignes };
  }
}
