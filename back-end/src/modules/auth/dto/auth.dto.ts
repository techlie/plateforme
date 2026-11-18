import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class ConnexionDto {
  @IsEmail({}, { message: 'Adresse électronique invalide.' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1, { message: 'Saisissez votre mot de passe.' })
  @MaxLength(128)
  motDePasse: string;
}

export class CodeDto {
  @IsUUID('4', { message: 'Demande de connexion inconnue.' })
  demande: string;

  @IsString()
  @Length(6, 6, { message: 'Le code compte six chiffres.' })
  @Matches(/^\d{6}$/, { message: 'Le code compte six chiffres.' })
  code: string;

  /** Reconnaître cet appareil : le code n'est plus demandé pendant 30 jours. */
  @IsOptional()
  @IsBoolean()
  faireConfiance?: boolean;
}

export class DemandeReinitialisationDto {
  @IsEmail({}, { message: 'Adresse électronique invalide.' })
  @MaxLength(254)
  email: string;
}

export class JetonDto {
  @IsString()
  @MinLength(20)
  @MaxLength(100)
  jeton: string;
}

export class DefinitionMotDePasseDto {
  @IsString()
  @MinLength(20)
  @MaxLength(100)
  jeton: string;

  @IsString()
  @MinLength(12, { message: 'Le mot de passe doit compter au moins 12 caractères.' })
  @MaxLength(128, { message: 'Le mot de passe ne peut pas dépasser 128 caractères.' })
  motDePasse: string;
}
