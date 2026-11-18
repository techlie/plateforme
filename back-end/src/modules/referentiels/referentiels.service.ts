import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nomComplet, UtilisateurConnecte } from '../../shared/acces/acces.types';
import { JournalService } from '../../shared/journal/journal.service';
import { dateParis, depuisDateBase, versDateBase } from '../../shared/regles/dates';
import { cleFonds, comparerListeFonds, lireCsvFonds, ResultatImport } from './regles/fonds';
import { isinValide } from '../../shared/regles/saisie';
import {
  ApporteurDto,
  CodeApporteurDto,
  CompagnieDto,
  FondsDto,
  GammeDto,
  ImportFondsDto,
  ModificationApporteurDto,
  ModificationCodeApporteurDto,
  ModificationCompagnieDto,
  ModificationGammeDto,
} from './dto/referentiels.dto';
import { LigneApporteur, LigneCode, ReferentielsRepository } from './referentiels.repository';

/** Un modèle de numéro se compose de 9, A, X et de caractères attendus tels quels (voir saisie.ts). */
function formatValable(format: string): boolean {
  return /^[\p{L}\p{N} ;./_-]+$/u.test(format);
}

function sortieApporteur(a: LigneApporteur) {
  return {
    id: a.id,
    nom: a.nom,
    prenom: a.prenom,
    email: a.email,
    role: a.role,
    restreint: a.restreint,
    habiliteReservationGlobale: a.habiliteReservationGlobale,
    actif: a.actif,
    entite: a.entite,
    compte: a.user ? { id: a.user.id, email: a.user.email, actif: a.user.actif } : null,
    codes: a.codes.map((c) => c.code),
  };
}

function sortieCode(c: LigneCode) {
  return {
    id: c.id,
    code: c.code,
    nature: c.nature,
    dateDebut: c.dateDebut ? depuisDateBase(c.dateDebut) : null,
    dateFin: c.dateFin ? depuisDateBase(c.dateFin) : null,
    actif: c.actif,
    compagnie: c.compagnie,
    apporteurs: c.autorises.map((a) => a.apporteur),
  };
}

/**
 * Référentiels communs : compagnies et gammes, apporteurs, codes apporteur, fonds.
 * Saisis une fois, jamais recopiés ; seuls les administrateurs les modifient
 * (le back-office peut ajouter un fonds vérifié).
 */
@Injectable()
export class ReferentielsService {
  constructor(
    private readonly repository: ReferentielsRepository,
    private readonly journal: JournalService,
  ) {}

  private tracer(auteur: UtilisateurConnecte, action: string, message: string, cible: string, details?: Prisma.InputJsonValue) {
    return this.journal.ecrire({ action, message, succes: true, userId: auteur.id, auteur: nomComplet(auteur), cible, details });
  }

  // Compagnies et gammes

  listerCompagnies() {
    return this.repository.listerCompagnies();
  }

  async compagnie(id: string) {
    const compagnie = await this.repository.trouverCompagnie(id);
    if (!compagnie) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Compagnie introuvable.' });
    }
    return compagnie;
  }

  async creerCompagnie(dto: CompagnieDto, auteur: UtilisateurConnecte) {
    const nom = dto.nom.trim();
    if (await this.repository.compagnieParNom(nom)) {
      throw new ConflictException({ code: 'EXISTE', message: 'Une compagnie porte déjà ce nom.' });
    }
    const format = dto.formatNumeroContrat?.trim() || null;
    if (format && !formatValable(format)) {
      throw new BadRequestException({ code: 'FORMAT', message: 'Modèle de numéro illisible : 9 pour un chiffre, A pour une lettre, X pour l’un ou l’autre, « ; » entre deux modèles.' });
    }
    const compagnie = await this.repository.creerCompagnie({ nom, formatNumeroContrat: format, exempleNumeroContrat: dto.exempleNumeroContrat?.trim() || null });
    await this.tracer(auteur, 'COMPAGNIE_CREEE', `Compagnie ${nom} créée.`, compagnie.id);
    return compagnie;
  }

  async modifierCompagnie(id: string, dto: ModificationCompagnieDto, auteur: UtilisateurConnecte) {
    const avant = await this.compagnie(id);
    if (dto.nom && dto.nom.trim().toLowerCase() !== avant.nom.toLowerCase() && (await this.repository.compagnieParNom(dto.nom.trim()))) {
      throw new ConflictException({ code: 'EXISTE', message: 'Une compagnie porte déjà ce nom.' });
    }
    const format = dto.formatNumeroContrat === undefined ? undefined : dto.formatNumeroContrat.trim() || null;
    if (format && !formatValable(format)) {
      throw new BadRequestException({ code: 'FORMAT', message: 'Modèle de numéro illisible : 9 pour un chiffre, A pour une lettre, X pour l’un ou l’autre, « ; » entre deux modèles.' });
    }
    const apres = await this.repository.modifierCompagnie(id, {
      nom: dto.nom?.trim(),
      formatNumeroContrat: format,
      exempleNumeroContrat: dto.exempleNumeroContrat === undefined ? undefined : dto.exempleNumeroContrat.trim() || null,
      actif: dto.actif,
    });
    await this.tracer(auteur, 'COMPAGNIE_MODIFIEE', `Compagnie ${apres.nom} modifiée.`, id, {
      avant: { nom: avant.nom, formatNumeroContrat: avant.formatNumeroContrat, actif: avant.actif },
    });
    return apres;
  }

  async ajouterGamme(compagnieId: string, dto: GammeDto, auteur: UtilisateurConnecte) {
    const compagnie = await this.compagnie(compagnieId);
    const nom = dto.nom.trim();
    if (await this.repository.gammeParNom(compagnieId, nom)) {
      throw new ConflictException({ code: 'EXISTE', message: 'Cette gamme existe déjà pour cette compagnie.' });
    }
    const gamme = await this.repository.creerGamme(compagnieId, nom);
    await this.tracer(auteur, 'GAMME_CREEE', `Gamme ${nom} ajoutée chez ${compagnie.nom}.`, gamme.id);
    return gamme;
  }

  async modifierGamme(id: string, dto: ModificationGammeDto, auteur: UtilisateurConnecte) {
    const avant = await this.repository.trouverGamme(id);
    if (!avant) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Gamme introuvable.' });
    }
    const apres = await this.repository.modifierGamme(id, { nom: dto.nom?.trim(), actif: dto.actif });
    await this.tracer(auteur, 'GAMME_MODIFIEE', `Gamme ${apres.nom} modifiée.`, id, { avant: { nom: avant.nom, actif: avant.actif } });
    return apres;
  }

  // Apporteurs

  async listerApporteurs() {
    return (await this.repository.listerApporteurs()).map(sortieApporteur);
  }

  async apporteur(id: string) {
    const a = await this.repository.trouverApporteur(id);
    if (!a) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Apporteur introuvable.' });
    }
    return sortieApporteur(a);
  }

  /** L'apporteur rattaché au compte connecté, s'il y en a un. */
  async apporteurDeCompte(userId: string) {
    const a = await this.repository.apporteurDeCompte(userId);
    return a ? sortieApporteur(a) : null;
  }

  private async verifierRattachements(entiteId: string | null | undefined, userId: string | null | undefined, apporteurId?: string) {
    if (entiteId && !(await this.repository.entiteExiste(entiteId))) {
      throw new BadRequestException({ code: 'ENTITE', message: 'Entité inconnue.' });
    }
    if (userId) {
      if (!(await this.repository.compteExiste(userId))) {
        throw new BadRequestException({ code: 'COMPTE', message: 'Compte inconnu.' });
      }
      const deja = await this.repository.apporteurDeCompte(userId);
      if (deja && deja.id !== apporteurId) {
        throw new ConflictException({ code: 'COMPTE_PRIS', message: 'Ce compte est déjà rattaché à un autre apporteur.' });
      }
    }
  }

  async creerApporteur(dto: ApporteurDto, auteur: UtilisateurConnecte) {
    await this.verifierRattachements(dto.entiteId, dto.userId);
    const a = await this.repository.creerApporteur({
      nom: dto.nom.trim(),
      prenom: dto.prenom.trim(),
      email: dto.email?.trim().toLowerCase() || null,
      role: dto.role,
      entiteId: dto.entiteId ?? null,
      userId: dto.userId ?? null,
      restreint: dto.restreint ?? false,
      habiliteReservationGlobale: dto.habiliteReservationGlobale ?? false,
    });
    await this.tracer(auteur, 'APPORTEUR_CREE', `Apporteur ${nomComplet(a)} créé.`, a.id, {
      role: a.role,
      entiteId: dto.entiteId ?? null,
      compte: dto.userId ?? null,
      restreint: a.restreint,
      habiliteReservationGlobale: a.habiliteReservationGlobale,
    });
    return sortieApporteur(a);
  }

  async modifierApporteur(id: string, dto: ModificationApporteurDto, auteur: UtilisateurConnecte) {
    const avant = await this.repository.trouverApporteur(id);
    if (!avant) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Apporteur introuvable.' });
    }
    const entiteId = dto.entiteId === undefined ? undefined : dto.entiteId || null;
    const userId = dto.userId === undefined ? undefined : dto.userId || null;
    await this.verifierRattachements(entiteId, userId, id);
    const apres = await this.repository.modifierApporteur(id, {
      nom: dto.nom?.trim(),
      prenom: dto.prenom?.trim(),
      email: dto.email === undefined ? undefined : dto.email.trim().toLowerCase() || null,
      role: dto.role,
      entiteId,
      userId,
      restreint: dto.restreint,
      habiliteReservationGlobale: dto.habiliteReservationGlobale,
      actif: dto.actif,
    });
    const action = dto.restreint !== undefined && dto.restreint !== avant.restreint ? (dto.restreint ? 'APPORTEUR_RESTREINT' : 'APPORTEUR_LIBRE') : 'APPORTEUR_MODIFIE';
    await this.tracer(auteur, action, `Apporteur ${nomComplet(apres)} modifié.`, id, {
      avant: {
        role: avant.role,
        entiteId: avant.entite?.id ?? null,
        compte: avant.user?.id ?? null,
        restreint: avant.restreint,
        habiliteReservationGlobale: avant.habiliteReservationGlobale,
        actif: avant.actif,
      },
    });
    return sortieApporteur(apres);
  }

  // Codes apporteur

  async listerCodes(compagnieId?: string) {
    return (await this.repository.listerCodes(compagnieId)).map(sortieCode);
  }

  async creerCode(dto: CodeApporteurDto, auteur: UtilisateurConnecte) {
    const compagnie = await this.compagnie(dto.compagnieId);
    const code = dto.code.trim();
    if (await this.repository.codeExiste(dto.compagnieId, code)) {
      throw new ConflictException({ code: 'EXISTE', message: 'Ce code existe déjà chez cette compagnie.' });
    }
    if (dto.dateDebut && dto.dateFin && dto.dateFin < dto.dateDebut) {
      throw new BadRequestException({ code: 'DATES', message: 'La fin de validité précède le début.' });
    }
    if (!(await this.repository.apporteursExistent(dto.apporteurIds))) {
      throw new BadRequestException({ code: 'APPORTEUR', message: 'Apporteur inconnu.' });
    }
    const cree = await this.repository.creerCode(
      {
        compagnieId: dto.compagnieId,
        code,
        nature: dto.nature,
        dateDebut: dto.dateDebut ? versDateBase(dto.dateDebut) : null,
        dateFin: dto.dateFin ? versDateBase(dto.dateFin) : null,
      },
      dto.apporteurIds,
    );
    await this.tracer(auteur, 'CODE_APPORTEUR_CREE', `Code ${code} créé chez ${compagnie.nom}.`, cree.id, { nature: dto.nature, apporteurs: dto.apporteurIds });
    return sortieCode(cree);
  }

  async modifierCode(id: string, dto: ModificationCodeApporteurDto, auteur: UtilisateurConnecte) {
    const avant = await this.repository.trouverCode(id);
    if (!avant) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Code introuvable.' });
    }
    for (const date of [dto.dateDebut, dto.dateFin]) {
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestException({ code: 'DATES', message: 'Date invalide : format AAAA-MM-JJ attendu.' });
      }
    }
    if (dto.apporteurIds && !(await this.repository.apporteursExistent(dto.apporteurIds))) {
      throw new BadRequestException({ code: 'APPORTEUR', message: 'Apporteur inconnu.' });
    }
    const apres = await this.repository.modifierCode(
      id,
      {
        nature: dto.nature,
        dateDebut: dto.dateDebut === undefined ? undefined : dto.dateDebut ? versDateBase(dto.dateDebut) : null,
        dateFin: dto.dateFin === undefined ? undefined : dto.dateFin ? versDateBase(dto.dateFin) : null,
        actif: dto.actif,
      },
      dto.apporteurIds,
    );
    await this.tracer(auteur, 'CODE_APPORTEUR_MODIFIE', `Code ${apres.code} modifié chez ${apres.compagnie.nom}.`, id, {
      avant: { nature: avant.nature, actif: avant.actif, apporteurs: avant.autorises.map((a) => a.apporteur.id) },
    });
    return sortieCode(apres);
  }

  /** Codes valables aujourd'hui pour un apporteur chez une compagnie : actifs, autorisés, dans leurs dates. */
  async codesValables(apporteurId: string, compagnieId: string, maintenant: Date) {
    const jour = dateParis(maintenant);
    return (await this.repository.codesAutorises(apporteurId, compagnieId))
      .filter((c) => (!c.dateDebut || depuisDateBase(c.dateDebut) <= jour) && (!c.dateFin || depuisDateBase(c.dateFin) >= jour))
      .map((c) => ({ id: c.id, code: c.code, nature: c.nature }));
  }

  // Fonds

  async listerFonds(compagnieId: string) {
    await this.compagnie(compagnieId);
    return (await this.repository.listerFonds(compagnieId)).map((f) => ({
      ...f,
      dateFermeture: f.dateFermeture?.toISOString() ?? null,
    }));
  }

  async ajouterFonds(dto: FondsDto, auteur: UtilisateurConnecte) {
    const compagnie = await this.compagnie(dto.compagnieId);
    const isin = dto.isin?.trim().toUpperCase() || null;
    if (isin && !isinValide(isin)) {
      throw new BadRequestException({ code: 'ISIN', message: 'Code ISIN invalide (clé de contrôle comprise).' });
    }
    const nom = dto.nom.trim();
    const cle = cleFonds(nom, isin);
    if (await this.repository.trouverFondsParCle(dto.compagnieId, cle)) {
      throw new ConflictException({ code: 'EXISTE', message: 'Ce fonds est déjà au référentiel.' });
    }
    const fonds = await this.repository.creerFonds({ compagnieId: dto.compagnieId, nom, isin, cle, origine: 'SAISIE' });
    await this.tracer(auteur, 'FONDS_AJOUTE', `Fonds ${nom} ajouté chez ${compagnie.nom}.`, fonds.id, { isin });
    return fonds;
  }

  /** Aperçu puis application d'une liste de fonds : rien n'est supprimé, un absent passe « fermé ». */
  async importerFonds(dto: ImportFondsDto, auteur: UtilisateurConnecte): Promise<ResultatImport & { isinInvalides: string[]; applique: boolean }> {
    const compagnie = await this.compagnie(dto.compagnieId);
    const lignes = lireCsvFonds(dto.contenu);
    if (lignes.length === 0) {
      throw new BadRequestException({ code: 'VIDE', message: 'Le fichier ne contient aucun fonds.' });
    }
    const isinInvalides = lignes.filter((l) => l.isin && !isinValide(l.isin)).map((l) => `${l.nom} (${l.isin})`);
    const connus = await this.repository.fondsConnus(dto.compagnieId);
    const resultat = comparerListeFonds(connus, lignes);
    if (!dto.appliquer) {
      return { ...resultat, isinInvalides, applique: false };
    }
    if (isinInvalides.length > 0) {
      throw new BadRequestException({ code: 'ISIN', message: `Codes ISIN invalides : ${isinInvalides.slice(0, 5).join(', ')}. Corrigez le fichier avant l’import.` });
    }
    const maintenant = new Date();
    const anciens = new Map(connus.map((f) => [f.id, f.anciensNoms]));
    await this.repository.transaction(async (tx) => {
      for (const a of resultat.ajouts) {
        await tx.fonds.create({ data: { compagnieId: dto.compagnieId, nom: a.nom, isin: a.isin, cle: a.cle, origine: 'IMPORT' } });
      }
      for (const r of resultat.renommages) {
        await tx.fonds.update({ where: { id: r.id }, data: { nom: r.nouveauNom, anciensNoms: [...(anciens.get(r.id) ?? []), r.ancienNom] } });
      }
      for (const f of resultat.fermetures) {
        await tx.fonds.update({ where: { id: f.id }, data: { ouvert: false, dateFermeture: maintenant } });
      }
      for (const f of resultat.reouvertures) {
        await tx.fonds.update({ where: { id: f.id }, data: { ouvert: true, dateFermeture: null } });
      }
    });
    await this.tracer(auteur, 'FONDS_IMPORTES', `Liste des fonds de ${compagnie.nom} importée.`, compagnie.id, {
      ajouts: resultat.ajouts.length,
      renommages: resultat.renommages.length,
      fermetures: resultat.fermetures.map((f) => f.nom),
      reouvertures: resultat.reouvertures.map((f) => f.nom),
    });
    return { ...resultat, isinInvalides, applique: true };
  }
}
