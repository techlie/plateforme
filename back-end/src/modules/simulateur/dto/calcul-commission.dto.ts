import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Demande de simulation envoyée par l'écran. Les taux sont en décimal : 0.03 pour 3 %. */
export class CalculCommissionDto {
  @IsString()
  @MaxLength(200)
  cleContrat: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  montant: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  frais?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  option?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  taux?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  variante?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  remuneration?: string;
}
