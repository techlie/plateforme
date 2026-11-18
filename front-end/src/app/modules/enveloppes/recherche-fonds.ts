/**
 * Recherche prédictive des fonds (section 6.10) : insensible aux majuscules, aux accents et à la
 * ponctuation ; chaque mot tapé doit correspondre au début d'un mot du nom, dans n'importe quel
 * ordre ; la recherche porte aussi sur le code ISIN ; les fonds ouverts passent avant les fermés.
 */
export function normaliserRecherche(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function correspond(fonds: { nom: string; isin: string | null }, saisie: string): boolean {
  const mots = normaliserRecherche(saisie).split(' ').filter(Boolean);
  if (mots.length === 0) return true;
  const motsNom = normaliserRecherche(fonds.nom).split(' ');
  const isin = (fonds.isin ?? '').toLowerCase();
  if (mots.length === 1 && isin.startsWith(mots[0])) return true;
  return mots.every((m) => motsNom.some((n) => n.startsWith(m)));
}

export function rechercherFonds<T extends { id: string; nom: string; isin: string | null; ouvert: boolean }>(liste: T[], saisie: string, dejaChoisis: string[] = [], limite = 30): T[] {
  return liste
    .filter((f) => !dejaChoisis.includes(f.id) && correspond(f, saisie))
    .sort((a, b) => Number(b.ouvert) - Number(a.ouvert) || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, limite);
}
