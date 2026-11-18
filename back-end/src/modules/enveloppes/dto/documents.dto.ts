import { IsIn } from 'class-validator';
import { CategorieDocument } from '@prisma/client';
import { CATEGORIES_ENVELOPPE, CATEGORIES_RESERVATION } from '../../../shared/documents/documents.service';

export class DepotDocumentEnveloppeDto {
  @IsIn(CATEGORIES_ENVELOPPE, { message: 'Catégorie de document inconnue.' })
  categorie: CategorieDocument;
}

export class DepotDocumentReservationDto {
  @IsIn(CATEGORIES_RESERVATION, { message: 'Catégorie de document inconnue.' })
  categorie: CategorieDocument;
}
