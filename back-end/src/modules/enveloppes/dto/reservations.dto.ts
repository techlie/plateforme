import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ModeArbitrage, ModeOperation, TypeClient, TypeOperation } from '@prisma/client';
import { EstDate, EstMontant, EstTaux } from '../../../shared/validation/decimaux';

export class LigneFondsDto {
  @IsOptional()
  @IsUUID()
  fondsId?: string;

  @IsString()
  @MinLength(1, { message: 'Le nom du fonds est obligatoire.' })
  @MaxLength(200)
  nom: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;

  @EstMontant()
  montant: string;
}

export class DerogationDto {
  @IsIn(['FORMAT_CONTRAT', 'DEPASSEMENT', 'DATE_LIMITE'])
  code: 'FORMAT_CONTRAT' | 'DEPASSEMENT' | 'DATE_LIMITE';

  @IsString()
  @MinLength(3, { message: 'Le motif de la dérogation est obligatoire.' })
  @MaxLength(500)
  motif: string;
}

export class ReservationDto {
  @IsUUID()
  enveloppeId: string;

  /** Saisie pour le compte d'un apporteur : back-office et administrateurs seulement. */
  @IsOptional()
  @IsUUID()
  apporteurId?: string;

  @IsEnum(TypeOperation)
  typeOperation: TypeOperation;

  @IsEnum(TypeClient)
  typeClient: TypeClient;

  @IsString()
  @MinLength(1, { message: 'Le nom du client est obligatoire.' })
  @MaxLength(120)
  clientNom: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientPrenom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numeroContrat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numeroDemande?: string;

  @EstMontant()
  montantBrut: string;

  /** Frais sur versement ou d'arbitrage, en décimal : 0.01 pour 1 %. */
  @EstTaux()
  tauxFrais: string;

  @IsBoolean()
  clientPrevendu: boolean;

  @IsOptional()
  @EstMontant()
  encoursClient?: string;

  @IsOptional()
  @IsUUID()
  codeApporteurId?: string;

  @IsOptional()
  @IsUUID()
  gammeId?: string;

  @IsOptional()
  @IsEnum(ModeArbitrage)
  modeArbitrage?: ModeArbitrage;

  @IsOptional()
  @EstTaux()
  pourcentageArbitrage?: string;

  @IsOptional()
  @EstMontant()
  valeurContrat?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => LigneFondsDto)
  fonds?: LigneFondsDto[];

  /** Puiser dans une réservation globale de l'apporteur plutôt que dans l'enveloppe globale. */
  @IsOptional()
  @IsUUID()
  reservationGlobaleId?: string;

  /** Client confié dont l'accord est signalé (section 6.11). */
  @IsOptional()
  @IsUUID()
  clientConfieId?: string;

  /** Enveloppe pleine : inscrire la demande en liste d'attente. */
  @IsOptional()
  @IsBoolean()
  listeAttente?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => DerogationDto)
  derogations?: DerogationDto[];
}

/** Modification d'une réservation : les champs absents ne changent pas. */
export class ModificationReservationDto {
  @IsOptional()
  @IsEnum(TypeClient)
  typeClient?: TypeClient;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  clientNom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientPrenom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numeroContrat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numeroDemande?: string;

  @IsOptional()
  @EstMontant()
  montantBrut?: string;

  @IsOptional()
  @EstTaux()
  tauxFrais?: string;

  @IsOptional()
  @IsBoolean()
  clientPrevendu?: boolean;

  @IsOptional()
  @EstMontant()
  encoursClient?: string;

  @IsOptional()
  @IsUUID()
  codeApporteurId?: string;

  @IsOptional()
  @IsUUID()
  gammeId?: string;

  @IsOptional()
  @IsEnum(ModeArbitrage)
  modeArbitrage?: ModeArbitrage;

  @IsOptional()
  @EstTaux()
  pourcentageArbitrage?: string;

  @IsOptional()
  @EstMontant()
  valeurContrat?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => LigneFondsDto)
  fonds?: LigneFondsDto[];

  /** Une baisse de montant est une annulation partielle : motif d'annulation obligatoire. */
  @IsOptional()
  @IsUUID()
  motifBaisseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => DerogationDto)
  derogations?: DerogationDto[];
}

export class DecisionDto {
  @IsUUID()
  motifId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}

export class AnnulationDto extends DecisionDto {
  /** Annulation tardive : le mandataire confirme après l'avertissement. */
  @IsOptional()
  @IsBoolean()
  confirmeTardive?: boolean;
}

export class PatrimoineDto {
  @IsBoolean()
  aJour: boolean;

  @IsOptional()
  @EstDate()
  date?: string;
}

export class DeclarationOperationDto {
  @EstDate()
  dateOperation: string;

  @IsEnum(ModeOperation)
  modeOperation: ModeOperation;
}

export class VerificationDto {
  @EstMontant()
  montantValide: string;

  @EstDate()
  dateValidationCompagnie: string;

  /** Si l'opération n'a pas encore été déclarée. */
  @IsOptional()
  @EstDate()
  dateOperation?: string;

  @IsOptional()
  @IsEnum(ModeOperation)
  modeOperation?: ModeOperation;

  /** Motif d'écart, si l'écart dépasse le seuil et qu'il est déjà connu. */
  @IsOptional()
  @IsUUID()
  motifEcartId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}

export class JustificationEcartDto {
  @IsUUID()
  motifEcartId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}

export class TraitementEcheanceDto {
  @IsString()
  @MinLength(3, { message: 'Le compte rendu du contact est obligatoire.' })
  @MaxLength(2000)
  compteRendu: string;

  /** Pour une prolongation : la nouvelle échéance. */
  @IsOptional()
  @EstDate()
  echeance?: string;
}

export class ServiceAttenteDto {
  /** Service partiel : nouveau montant brut, avec l'accord du mandataire. */
  @IsOptional()
  @EstMontant()
  montantBrut?: string;

  @IsOptional()
  @IsBoolean()
  accordMandataire?: boolean;

  /** Servir sans place disponible : dérogation motivée. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motifDerogation?: string;

  /** Choix hors de l'ordre d'arrivée : tracé. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motifHorsOrdre?: string;
}

export class TauxDto {
  @EstTaux()
  taux: string;

  @IsString()
  @MinLength(3, { message: 'Le motif est obligatoire.' })
  @MaxLength(500)
  motif: string;
}

export class EntiteReservationDto {
  @IsUUID()
  entiteId: string;
}

export class FiltreReservationsDto {
  @IsOptional()
  @IsUUID()
  enveloppe?: string;

  @IsOptional()
  @IsIn(['a-valider', 'a-verifier', 'ecarts', 'echues', 'attente', 'actives', 'toutes'])
  file?: string;

  @IsOptional()
  @IsUUID()
  apporteur?: string;
}
