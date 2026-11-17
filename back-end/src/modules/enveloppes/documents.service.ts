import { BadRequestException, Inject, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { CategorieDocument } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { nomComplet, UtilisateurConnecte } from '../../shared/acces/acces.types';
import { CONFIGURATION } from '../../shared/configuration';
import type { Configuration } from '../../shared/configuration';
import { JournalService } from '../../shared/journal/journal.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { genererJeton } from '../../shared/securite/securite';
import { estGestion } from './acces-enveloppes';

export const TAILLE_MAX_DOCUMENT = 15 * 1024 * 1024;

/** Types acceptés, reconnus à leur contenu et non à leur seul nom. */
const SIGNATURES: { type: string; extension: string; debut: number[] }[] = [
  { type: 'application/pdf', extension: 'pdf', debut: [0x25, 0x50, 0x44, 0x46] },
  { type: 'image/png', extension: 'png', debut: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/jpeg', extension: 'jpg', debut: [0xff, 0xd8, 0xff] },
];

export const CATEGORIES_ENVELOPPE: CategorieDocument[] = ['DOCUMENTATION_TECHNIQUE', 'AVENANT_COMPAGNIE', 'FICHE_PRODUIT', 'AVENANT_VIERGE'];
export const CATEGORIES_RESERVATION: CategorieDocument[] = ['PREUVE_VERIFICATION', 'JUSTIFICATIF_OPERATION'];

export interface FichierRecu {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/**
 * Documents déposés : rangés hors du dossier public sous un nom tiré au hasard, avec leur
 * empreinte. Chaque dépôt et chaque téléchargement est journalisé.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    @Inject(CONFIGURATION) private readonly configuration: Configuration,
  ) {}

  private dossier(): string {
    return resolve(this.configuration.dossierDocuments);
  }

  async deposer(
    fichier: FichierRecu | undefined,
    categorie: CategorieDocument,
    rattachement: { enveloppeId?: string; reservationId?: string },
    auteur: UtilisateurConnecte,
  ) {
    if (!fichier) {
      throw new BadRequestException({ code: 'FICHIER', message: 'Aucun fichier reçu.' });
    }
    if (fichier.size > TAILLE_MAX_DOCUMENT) {
      throw new PayloadTooLargeException({ code: 'TAILLE', message: 'Le fichier dépasse 15 Mo.' });
    }
    const signature = SIGNATURES.find((s) => s.debut.every((octet, i) => fichier.buffer[i] === octet));
    if (!signature) {
      throw new BadRequestException({ code: 'TYPE', message: 'Seuls les fichiers PDF, PNG et JPEG sont acceptés.' });
    }
    const nomFichier = `${genererJeton()}.${signature.extension}`;
    await mkdir(this.dossier(), { recursive: true });
    await writeFile(join(this.dossier(), nomFichier), fichier.buffer, { mode: 0o600 });
    const empreinte = createHash('sha256').update(fichier.buffer).digest('hex');
    const nom = fichier.originalname.replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 150) || `document.${signature.extension}`;
    const doc = await this.prisma.document.create({
      data: {
        categorie,
        nom,
        typeMime: signature.type,
        taille: fichier.size,
        fichier: nomFichier,
        empreinte,
        enveloppeId: rattachement.enveloppeId ?? null,
        reservationId: rattachement.reservationId ?? null,
        auteurId: auteur.id,
        auteur: nomComplet(auteur),
      },
      select: { id: true, categorie: true, nom: true, typeMime: true, taille: true, createdAt: true, auteur: true },
    });
    await this.journal.ecrire({
      action: 'DOCUMENT_DEPOSE',
      message: `Document déposé : ${nom}.`,
      succes: true,
      userId: auteur.id,
      auteur: nomComplet(auteur),
      cible: doc.id,
      details: { categorie, empreinte, ...rattachement },
    });
    return doc;
  }

  /** Lecture d'un document, après contrôle des droits : le filtrage se fait ici, côté serveur. */
  async lire(id: string, u: UtilisateurConnecte): Promise<{ nom: string; typeMime: string; contenu: Buffer }> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        enveloppe: { select: { statut: true } },
        reservation: { select: { apporteur: { select: { userId: true } } } },
      },
    });
    const introuvable = new NotFoundException({ code: 'INCONNU', message: 'Document introuvable.' });
    if (!doc) {
      throw introuvable;
    }
    if (!estGestion(u)) {
      const permisEnveloppe = doc.enveloppe && doc.categorie !== 'AVENANT_VIERGE' && ['OUVERTE', 'FERMEE'].includes(doc.enveloppe.statut);
      const permisReservation = doc.reservation && doc.reservation.apporteur.userId === u.id;
      if (!permisEnveloppe && !permisReservation) {
        throw introuvable;
      }
    }
    const contenu = await readFile(join(this.dossier(), doc.fichier));
    await this.journal.ecrire({
      action: 'DOCUMENT_LU',
      message: `Document consulté : ${doc.nom}.`,
      succes: true,
      userId: u.id,
      auteur: nomComplet(u),
      cible: doc.id,
    });
    return { nom: doc.nom, typeMime: doc.typeMime, contenu };
  }
}
