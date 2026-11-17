import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { nomComplet, UtilisateurConnecte } from '../../shared/acces/acces.types';
import { JournalService } from '../../shared/journal/journal.service';
import { CreationEntiteDto, ModificationEntiteDto } from './dto/entites.dto';
import { EntitesRepository } from './entites.repository';

/** Entités du groupe. La liste reste ouverte : l'administrateur en ajoute quand il le faut. */
@Injectable()
export class EntitesService {
  constructor(
    private readonly repository: EntitesRepository,
    private readonly journal: JournalService,
  ) {}

  lister() {
    return this.repository.lister();
  }

  async creer(dto: CreationEntiteDto, auteur: UtilisateurConnecte) {
    const nom = dto.nom.trim();
    if (await this.repository.trouverParNom(nom)) {
      throw new ConflictException({ code: 'ENTITE_EXISTE', message: 'Une entité porte déjà ce nom.' });
    }
    const entite = await this.repository.creer({ nom, orias: dto.orias?.trim() || null, membreSofraco: dto.membreSofraco ?? false });
    await this.journal.ecrire({
      action: 'ENTITE_CREEE',
      message: `Entité ${nom} créée.`,
      succes: true,
      userId: auteur.id,
      auteur: nomComplet(auteur),
      cible: entite.id,
    });
    return entite;
  }

  async modifier(id: string, dto: ModificationEntiteDto, auteur: UtilisateurConnecte) {
    const avant = await this.repository.trouver(id);
    if (!avant) {
      throw new NotFoundException({ code: 'INCONNU', message: 'Entité introuvable.' });
    }
    if (dto.nom && dto.nom.trim().toLowerCase() !== avant.nom.toLowerCase()) {
      const homonyme = await this.repository.trouverParNom(dto.nom.trim());
      if (homonyme && homonyme.id !== id) {
        throw new ConflictException({ code: 'ENTITE_EXISTE', message: 'Une entité porte déjà ce nom.' });
      }
    }
    const apres = await this.repository.modifier(id, {
      nom: dto.nom?.trim(),
      orias: dto.orias === undefined ? undefined : dto.orias.trim() || null,
      membreSofraco: dto.membreSofraco,
      actif: dto.actif,
    });
    await this.journal.ecrire({
      action: 'ENTITE_MODIFIEE',
      message: `Entité ${apres.nom} modifiée.`,
      succes: true,
      userId: auteur.id,
      auteur: nomComplet(auteur),
      cible: id,
      details: { avant: { nom: avant.nom, orias: avant.orias, membreSofraco: avant.membreSofraco, actif: avant.actif } },
    });
    return apres;
  }
}
