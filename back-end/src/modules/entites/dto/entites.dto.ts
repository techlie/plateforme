import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreationEntiteDto {
  @IsString()
  @MinLength(1, { message: 'Le nom est obligatoire.' })
  @MaxLength(120)
  nom: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  orias?: string;

  @IsOptional()
  @IsBoolean()
  membreSofraco?: boolean;
}

export class ModificationEntiteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  orias?: string;

  @IsOptional()
  @IsBoolean()
  membreSofraco?: boolean;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
