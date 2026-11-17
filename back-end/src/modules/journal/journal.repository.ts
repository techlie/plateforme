import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class JournalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async rechercher(filtre: Prisma.LogWhereInput, page: number, parPage: number) {
    const [lignes, total] = await this.prisma.$transaction([
      this.prisma.log.findMany({
        where: filtre,
        orderBy: { date: 'desc' },
        skip: (page - 1) * parPage,
        take: parPage,
        select: { id: true, date: true, action: true, message: true, statut: true, auteur: true, cible: true, adresseIp: true, userId: true },
      }),
      this.prisma.log.count({ where: filtre }),
    ]);
    return { lignes, total };
  }
}
