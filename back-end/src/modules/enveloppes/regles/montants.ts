import { Prisma } from '@prisma/client';

/**
 * Montants des enveloppes. Calculs exacts en décimal ; l'arrondi au centime se fait une seule
 * fois, à la fin de chaque calcul. Fonctions pures : ni base, ni horloge.
 */
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
export type Montant = Decimal | string | number;

export const ZERO = new Decimal(0);

export function d(valeur: Montant): Decimal {
  return valeur instanceof Decimal ? valeur : new Decimal(valeur);
}

/** Arrondi au centime le plus proche, la moitié vers le haut en valeur absolue. */
export function arrondirAuCentime(montant: Montant): Decimal {
  return d(montant).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Montant net investi = montant brut − frais (en pourcentage du brut). */
export function montantNet(brut: Montant, tauxFrais: Montant): Decimal {
  return arrondirAuCentime(d(brut).times(new Decimal(1).minus(d(tauxFrais))));
}

/** Commission = montant × taux. Estimée sur le réservé, définitive sur le validé. */
export function commission(montant: Montant, taux: Montant): Decimal {
  return arrondirAuCentime(d(montant).times(d(taux)));
}

export function somme(valeurs: Montant[]): Decimal {
  return valeurs.reduce<Decimal>((total, v) => total.plus(d(v)), ZERO);
}

export function max(a: Montant, b: Montant): Decimal {
  return Decimal.max(d(a), d(b));
}

/** Part de b dans a (a ÷ b) ; nulle quand b est nul. Non arrondie. */
export function part(a: Montant, b: Montant): Decimal {
  const diviseur = d(b);
  return diviseur.isZero() ? ZERO : d(a).dividedBy(diviseur);
}
