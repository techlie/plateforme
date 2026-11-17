import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { NatureCodeApporteur, RoleApporteur } from '@prisma/client';
import { EstDate } from '../../../shared/validation/decimaux';

export class CompagnieDto {
  @IsString()
  @MinLength(1, { message: 'Le nom est obligatoire.' })
  @MaxLength(120)
  nom: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  formatNumeroContrat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  exempleNumeroContrat?: string;
}

export class ModificationCompagnieDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  formatNumeroContrat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  exempleNumeroContrat?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class GammeDto {
  @IsString()
  @MinLength(1, { message: 'Le nom de la gamme est obligatoire.' })
  @MaxLength(120)
  nom: string;
}

export class ModificationGammeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class ApporteurDto {
  @IsString()
  @MinLength(1, { message: 'Le nom est obligatoire.' })
  @MaxLength(80)
  nom: string;

  @IsString()
  @MinLength(1, { message: 'Le prénom est obligatoire.' })
  @MaxLength(80)
  prenom: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse invalide.' })
  email?: string;

  @IsEnum(RoleApporteur)
  role: RoleApporteur;

  @IsOptional()
  @IsUUID()
  entiteId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  restreint?: boolean;

  @IsOptional()
  @IsBoolean()
  habiliteReservationGlobale?: boolean;
}

export class ModificationApporteurDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nom?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  prenom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsEnum(RoleApporteur)
  role?: RoleApporteur;

  /** Vide pour retirer l'entité. */
  @IsOptional()
  @IsString()
  entiteId?: string;

  /** Vide pour détacher le compte. */
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  restreint?: boolean;

  @IsOptional()
  @IsBoolean()
  habiliteReservationGlobale?: boolean;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class CodeApporteurDto {
  @IsUUID()
  compagnieId: string;

  @IsString()
  @MinLength(1, { message: 'Le code est obligatoire.' })
  @MaxLength(60)
  code: string;

  @IsEnum(NatureCodeApporteur)
  nature: NatureCodeApporteur;

  @IsOptional()
  @EstDate()
  dateDebut?: string;

  @IsOptional()
  @EstDate()
  dateFin?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  apporteurIds: string[];
}

export class ModificationCodeApporteurDto {
  @IsOptional()
  @IsEnum(NatureCodeApporteur)
  nature?: NatureCodeApporteur;

  @IsOptional()
  @IsString()
  dateDebut?: string;

  @IsOptional()
  @IsString()
  dateFin?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  apporteurIds?: string[];
}

export class FondsDto {
  @IsUUID()
  compagnieId: string;

  @IsString()
  @MinLength(1, { message: 'Le nom du fonds est obligatoire.' })
  @MaxLength(200)
  nom: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;
}

export class ImportFondsDto {
  @IsUUID()
  compagnieId: string;

  /** Contenu du fichier CSV : nom du fonds et code ISIN. */
  @IsString()
  @MaxLength(2_000_000)
  contenu: string;

  /** Faux : aperçu seulement. Vrai : l'import est appliqué. */
  @Type(() => Boolean)
  @IsBoolean()
  appliquer: boolean;
}
