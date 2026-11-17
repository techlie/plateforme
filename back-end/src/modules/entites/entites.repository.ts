import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class EntitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  lister() {
    return this.prisma.entite.findMany({ orderBy: { nom: 'asc' } });
  }

  trouverParNom(nom: string) {
    return this.prisma.entite.findFirst({ where: { nom: { equals: nom, mode: 'insensitive' } } });
  }

  trouver(id: string) {
    return this.prisma.entite.findUnique({ where: { id } });
  }

  creer(data: Prisma.EntiteCreateInput) {
    return this.prisma.entite.create({ data });
  }

  modifier(id: string, data: Prisma.EntiteUpdateInput) {
    return this.prisma.entite.update({ where: { id }, data });
  }
}
