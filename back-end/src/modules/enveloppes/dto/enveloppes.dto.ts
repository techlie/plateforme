import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CategorieMotif, ImputabiliteMotif, TypeClient, TypeMouvement } from '@prisma/client';
import { EstDate, EstMontant, EstTaux } from '../../../shared/validation/decimaux';

export class EnveloppeDto {
  @IsUUID()
  compagnieId: string;

  @IsString()
  @MinLength(1, { message: 'Le nom du produit est obligatoire.' })
  @MaxLength(200)
  nomProduit: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;

  @EstMontant()
  montantInitial: string;

  @EstDate()
  dateOuverture: string;

  @EstDate()
  dateLimiteInterne: string;

  @EstDate()
  dateFinCommercialisation: string;

  @EstDate()
  dateClotureProduit: string;

  @EstTaux()
  tauxCommission: string;

  @EstTaux()
  tauxClientsConfies: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  rendement?: string;

  @IsOptional()
  @EstTaux()
  seuilConcentration?: string;

  @EstMontant()
  montantMinimum: string;

  @IsOptional()
  @IsBoolean()
  controlePatrimoine?: boolean;

  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  gammesExclues: string[];
}

export class ModificationEnveloppeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nomProduit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;

  @IsOptional()
  @EstMontant()
  montantInitial?: string;

  @IsOptional()
  @EstDate()
  dateOuverture?: string;

  @IsOptional()
  @EstDate()
  dateLimiteInterne?: string;

  @IsOptional()
  @EstDate()
  dateFinCommercialisation?: string;

  @IsOptional()
  @EstDate()
  dateClotureProduit?: string;

  @IsOptional()
  @EstTaux()
  tauxCommission?: string;

  @IsOptional()
  @EstTaux()
  tauxClientsConfies?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  rendement?: string;

  /** Vide pour retirer le seuil. */
  @IsOptional()
  @IsString()
  @Matches(/^$|^(0(\.\d{1,6})?|1(\.0{1,6})?)$/, { message: 'Taux invalide.' })
  seuilConcentration?: string;

  @IsOptional()
  @EstMontant()
  montantMinimum?: string;

  @IsOptional()
  @IsBoolean()
  controlePatrimoine?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  gammesExclues?: string[];

  /** Obligatoire pour modifier une enveloppe ouverte : la modification est notifiée aux mandataires. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motif?: string;
}

export class StatutProduitDto {
  @IsIn(['ANNULEE', 'REPORTEE'])
  statut: 'ANNULEE' | 'REPORTEE';

  @IsString()
  @MinLength(3, { message: 'Le motif est obligatoire.' })
  @MaxLength(500)
  motif: string;
}

export class MouvementDto {
  @IsEnum(TypeMouvement)
  type: TypeMouvement;

  @EstMontant()
  montant: string;

  @IsString()
  @MinLength(3, { message: 'Le motif est obligatoire.' })
  @MaxLength(500)
  motif: string;
}

export class UpfrontDto {
  /** Vide pour effacer. */
  @IsString()
  @Matches(/^$|^(0(\.\d{1,6})?|1(\.0{1,6})?)$/, { message: 'Taux invalide.' })
  taux: string;
}

export class ReservationGlobaleDto {
  @IsUUID()
  apporteurId: string;

  @EstMontant()
  montant: string;

  @IsString()
  @MinLength(3, { message: 'Le motif est obligatoire.' })
  @MaxLength(500)
  motif: string;

  @EstDate()
  echeance: string;
}

export class LiberationGlobaleDto {
  @EstMontant()
  montant: string;

  @IsString()
  @MinLength(3, { message: 'Le motif est obligatoire.' })
  @MaxLength(500)
  motif: string;
}

export class ProlongationGlobaleDto {
  @EstDate()
  echeance: string;

  @IsString()
  @MinLength(3, { message: 'Le compte rendu est obligatoire.' })
  @MaxLength(2000)
  compteRendu: string;
}

export class ClientConfieDto {
  @IsUUID()
  apporteurId: string;

  @IsEnum(TypeClient)
  typeClient: TypeClient;

  @IsString()
  @MinLength(1, { message: 'Le nom est obligatoire.' })
  @MaxLength(120)
  clientNom: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientPrenom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  numeroContrat?: string;

  /** Vide : le taux de la convention de l'apporteur ; à défaut, celui de l'enveloppe. */
  @IsOptional()
  @EstTaux()
  taux?: string;
}

export class MotifDto {
  @IsEnum(CategorieMotif)
  categorie: CategorieMotif;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  libelle: string;

  @IsOptional()
  @IsEnum(ImputabiliteMotif)
  imputabilite?: ImputabiliteMotif;

  @IsOptional()
  @IsBoolean()
  commentaireObligatoire?: boolean;
}

export class ModificationMotifDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  libelle?: string;

  @IsOptional()
  @IsEnum(ImputabiliteMotif)
  imputabilite?: ImputabiliteMotif;

  @IsOptional()
  @IsBoolean()
  commentaireObligatoire?: boolean;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class ParametresDto {
  /** null : délai pas encore fixé. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  delaiHonorerJours?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  rappelAvantEcheanceJours?: number | null;

  @IsOptional()
  @EstTaux()
  seuilEcart?: string;

  @IsOptional()
  @EstTaux()
  seuilEstimationArbitrage?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  delaiAnnulationTardiveJours?: number;

  @IsOptional()
  @EstTaux()
  tauxClientsConfiesDefaut?: string;

  @IsOptional()
  @EstTaux()
  seuilConcentrationDefaut?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  compteAReboursJours?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  emailingJour?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure invalide : HH:MM attendu.' })
  emailingHeure?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  relancesRapprocheesJours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  emailingJourRapproche?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  alerteBackOfficeJours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  ancienneteAnnulationJours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  poidsAnnulationAggravee?: number;
}

