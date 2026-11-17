import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ModulePlateforme, Profil } from '@prisma/client';

export class CreationUtilisateurDto {
  @IsEmail({}, { message: 'Adresse électronique invalide.' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1, { message: 'Le nom est obligatoire.' })
  @MaxLength(100)
  nom: string;

  @IsString()
  @MinLength(1, { message: 'Le prénom est obligatoire.' })
  @MaxLength(100)
  prenom: string;

  @IsEnum(Profil, { message: 'Profil inconnu.' })
  profil: Profil;

  @IsOptional()
  @IsUUID('4')
  entiteId?: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(ModulePlateforme, { each: true, message: 'Module inconnu.' })
  modules: ModulePlateforme[];
}

export class ModificationUtilisateurDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nom?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  prenom?: string;

  @IsOptional()
  @IsEnum(Profil, { message: 'Profil inconnu.' })
  profil?: Profil;

  /** null pour retirer le rattachement. */
  @IsOptional()
  @ValidateIf((_objet, valeur) => valeur !== null)
  @IsUUID('4')
  entiteId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(ModulePlateforme, { each: true, message: 'Module inconnu.' })
  modules?: ModulePlateforme[];

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
