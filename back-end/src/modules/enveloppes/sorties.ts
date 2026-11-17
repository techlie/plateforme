import type { Decimal } from './regles/montants';
import type { Compteurs } from './regles/compteurs';
import { depuisDateBase } from '../../shared/regles/dates';

/** Montant en texte, au centime : « 12500.00 ». */
export function texteMontant(m: Decimal | null | undefined): string | null {
  return m === null || m === undefined ? null : m.toFixed(2);
}

/** Taux en texte décimal : « 0.02 ». */
export function texteTaux(t: Decimal | null | undefined): string | null {
  return t === null || t === undefined ? null : t.toString();
}

export function texteDate(date: Date | null | undefined): string | null {
  return date ? depuisDateBase(date) : null;
}

/** Compteurs vus par le back-office et les administrateurs : les deux côte à côte. */
export function compteursGestion(c: Compteurs) {
  return {
    enveloppeTotale: c.enveloppeTotale.toFixed(2),
    restante: c.restante.toFixed(2),
    tauxRemplissage: c.tauxRemplissage.toDecimalPlaces(4).toString(),
    reelValide: c.reelValide.toFixed(2),
    reelRestant: c.reelRestant.toFixed(2),
    tauxReel: c.tauxReel.toDecimalPlaces(4).toString(),
    depassement: c.depassement.toFixed(2),
  };
}

/** Compteurs vus par le mandataire : l'enveloppe restante seulement. */
export function compteursMandataire(c: Compteurs) {
  return {
    enveloppeTotale: c.enveloppeTotale.toFixed(2),
    restante: c.restante.toFixed(2),
    tauxRemplissage: c.tauxRemplissage.toDecimalPlaces(4).toString(),
    depassement: c.depassement.toFixed(2),
  };
}
