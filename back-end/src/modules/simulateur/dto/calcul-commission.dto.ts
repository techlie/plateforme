import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  /** Âge de l'assuré, en années révolues. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  /** Part des versements investie en unités de compte, en décimal. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  partUc?: number;

  /** Versements annuels déjà en place pour ce client sur le même type de contrat, en euros. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  versementsExistants?: number;

  /**
   * Part reversée au cabinet d'expertise comptable en co-courtage, en décimal, sur la commission brute
   * de la compagnie. À omettre quand il n'y a pas de convention.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  tauxCoCourtage?: number;
}
