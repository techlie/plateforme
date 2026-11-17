import { Matches, registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Montants et taux voyagent en texte ("12500.00", "0.02") pour rester exacts : ils sont lus
 * en décimal côté serveur, jamais en nombre à virgule flottante.
 */
export const FORMAT_MONTANT = /^\d{1,12}(\.\d{1,2})?$/;
export const FORMAT_TAUX = /^(0(\.\d{1,6})?|1(\.0{1,6})?)$/;

export function EstMontant(options?: ValidationOptions) {
  return Matches(FORMAT_MONTANT, { message: 'Montant invalide : chiffres et point décimal, deux décimales au plus.', ...options });
}

/** Taux exprimé en décimal : 0.02 pour 2 %. Entre 0 et 1. */
export function EstTaux(options?: ValidationOptions) {
  return Matches(FORMAT_TAUX, { message: 'Taux invalide : nombre décimal entre 0 et 1 (0.02 pour 2 %).', ...options });
}

/** Date de calendrier « AAAA-MM-JJ », réelle (pas de 30 février). */
export function EstDate(options?: ValidationOptions) {
  return function (objet: object, propriete: string) {
    registerDecorator({
      name: 'estDate',
      target: objet.constructor,
      propertyName: propriete,
      options: { message: 'Date invalide : format AAAA-MM-JJ attendu.', ...options },
      validator: {
        validate(valeur: unknown) {
          if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
            return false;
          }
          const t = new Date(`${valeur}T00:00:00Z`);
          return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === valeur;
        },
      },
    });
  };
}
