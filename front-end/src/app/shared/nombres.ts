/** Lecture et écriture des nombres à la française : « 1 200,50 ». */

/** Lit une saisie libre. Renvoie `null` si ce n'est pas un nombre positif. */
export function lireNombre(saisie: string): number | null {
  const propre = saisie.replace(/[\s  €%]/g, '').replace(',', '.');
  if (propre === '' || !/^\d*\.?\d*$/.test(propre)) {
    return null;
  }
  const valeur = Number(propre);
  return Number.isFinite(valeur) ? valeur : null;
}

/** Lit un pourcentage saisi (« 3 » ou « 2,95 ») et le rend en décimal (0.03, 0.0295). */
export function lirePourcent(saisie: string): number | null {
  const valeur = lireNombre(saisie);
  return valeur === null ? null : Math.round(valeur * 1e8) / 1e10;
}

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const DECIMAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

export function formaterEuros(montant: number): string {
  return EUROS.format(montant);
}

/** Écrit un taux décimal en pourcentage, sans le signe : 0.0295 → « 2,95 ». */
export function ecrirePourcent(taux: number): string {
  return DECIMAL.format(Math.round(taux * 1e6) / 1e4);
}

/** Met un texte en minuscules sans accents, pour comparer des recherches. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Empêche un retour à la ligne entre un nombre et son unité : « 100 % », « 1 500 € ». */
export function insecable(texte: string): string {
  return texte.replace(/ (%|€)/g, '\u00a0$1').replace(/(\d) (\d{3})(?!\d)/g, '$1\u202f$2');
}
