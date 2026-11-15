import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CalculCommissionDto } from './dto/calcul-commission.dto';
import { CatalogueSimulateur, ResultatSimulation } from './dto/simulateur.reponses';
import { calculerCommission, DemandeCalcul, ErreurCalcul, trouverContrat } from './moteur/moteur-commission';
import { estimerReprise } from './moteur/reprise';
import { Referentiel } from './moteur/referentiel.types';
import { SimulateurRepository } from './simulateur.repository';

@Injectable()
export class SimulateurService {
  constructor(private readonly repository: SimulateurRepository) {}

  private baremeEnVigueur(date: string): Referentiel {
    const referentiel = this.repository.trouverEnVigueur(date);
    if (!referentiel) {
      throw new ServiceUnavailableException("Aucun barème de commissions n'est en vigueur à cette date.");
    }
    return referentiel;
  }

  private static enTete(referentiel: Referentiel) {
    return { code: referentiel.code, libelle: referentiel.libelle, dateEffet: referentiel.dateEffet };
  }

  /** Liste des contrats simulables, sans les taux internes du barème. */
  catalogue(date: string): CatalogueSimulateur {
    const referentiel = this.baremeEnVigueur(date);
    return {
      bareme: SimulateurService.enTete(referentiel),
      coCourtage: { tauxParDefaut: referentiel.coCourtage.tauxParDefaut, tauxMax: referentiel.coCourtage.tauxMax },
      contrats: referentiel.contrats.map((c) => ({
        cle: c.cle,
        compagnie: c.compagnieLibelle,
        famille: c.familleLibelle,
        libelle: c.libelle,
        base: c.base,
        horsTaxe: c.horsTaxe,
        saisie: c.saisie,
        options: (c.options ?? []).map((o) => ({ code: o.code, libelle: o.libelle })),
        variantes: (c.variantes ?? []).map((v) => ({ code: v.code, libelle: v.libelle })),
        remunerations: (c.remunerations ?? []).map((r) => ({ code: r.code, libelle: r.libelle })),
        remunerationParDefaut: c.remunerationParDefaut,
        fraisParDefaut: c.fraisParDefaut,
        fraisMax: c.fraisMax,
        demandeAge: !!c.ponderationAge,
        demandePartUc: !!c.surcommission,
        plafondAnnuel: c.plafondSurcommission?.montantAnnuel,
        tauxMin: c.tauxMin,
        tauxMax: c.tauxMax,
        seuilMontant: c.seuilMontant,
        aide: c.aide,
      })),
    };
  }

  /**
   * Estime la commission du mandataire.
   *
   * Tant que les espaces mandataires n'existent pas, le taux de réversion est celui de référence
   * du barème. Il viendra ensuite de la fiche du mandataire connecté, jamais de l'écran.
   */
  simuler(demande: CalculCommissionDto, date: string): ResultatSimulation {
    const referentiel = this.baremeEnVigueur(date);
    try {
      const entree: DemandeCalcul = {
        montant: demande.montant,
        frais: demande.frais,
        option: demande.option,
        taux: demande.taux,
        variante: demande.variante,
        remuneration: demande.remuneration,
        age: demande.age,
        partUc: demande.partUc,
        versementsExistants: demande.versementsExistants,
        tauxCoCourtage: demande.tauxCoCourtage,
        tauxReversion: referentiel.tauxReversionReference,
      };
      const calcul = calculerCommission(referentiel, demande.cleContrat, entree);
      const reprise = estimerReprise(trouverContrat(referentiel, demande.cleContrat), entree, calcul);
      // Vue mandataire : ni la commission versée par la compagnie, ni la part du cabinet.
      return {
        bareme: SimulateurService.enTete(referentiel),
        cleContrat: calcul.cleContrat,
        montant: calcul.montantMandataire,
        baseCalcul: calcul.baseCalcul,
        baseHorsTaxe: calcul.baseHorsTaxe,
        lignes: calcul.composantes.map((c) => ({ code: c.code, libelle: c.libelle, montant: c.montant })),
        varianteRetenue: calcul.varianteRetenue,
        remunerationRetenue: calcul.remunerationRetenue,
        avertissements: calcul.avertissements,
        coCourtage:
          calcul.tauxCoCourtage > 0 ? { taux: calcul.tauxCoCourtage, montant: calcul.montantCoCourtage } : undefined,
        reprise,
        reserves: calcul.aConfirmer,
      };
    } catch (erreur) {
      if (erreur instanceof ErreurCalcul) {
        throw new BadRequestException({ code: erreur.code, message: erreur.message });
      }
      throw erreur;
    }
  }
}
