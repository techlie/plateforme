/** Règles de forme des saisies : ISIN, numéro de contrat, nom du client. Fonctions pures. */

/** Retire espaces et retours à la ligne, comme le prévoit le contrôle du numéro de contrat. */
export function nettoyerNumeroContrat(numero: string): string {
  return numero.replace(/\s+/g, '');
}

/**
 * Le numéro respecte-t-il le format de la compagnie ? Tant que le format n'est pas connu
 * (champ vide dans le référentiel), seule la présence est contrôlée.
 */
export function numeroConforme(numero: string, format: string | null): boolean {
  if (!format) {
    return numero.length > 0;
  }
  try {
    return new RegExp(`^(?:${format})$`).test(numero);
  } catch {
    return false;
  }
}

/** Code ISIN : 2 lettres, 9 caractères alphanumériques, 1 chiffre de contrôle (Luhn sur les chiffres convertis). */
export function isinValide(isin: string): boolean {
  const code = isin.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(code)) {
    return false;
  }
  const chiffres = code
    .split('')
    .map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c))
    .join('');
  let total = 0;
  for (let i = 0; i < chiffres.length; i++) {
    let n = Number(chiffres[chiffres.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    total += n;
  }
  return total % 10 === 0;
}

/** Texte sans accents, ponctuation ni majuscules, mots séparés par une espace. */
export function normaliserTexte(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Clé d'un client pour repérer ses réservations : nom et prénom, ou raison sociale, normalisés. */
export function cleClient(nom: string, prenom: string | null): string {
  return normaliserTexte(`${nom} ${prenom ?? ''}`);
}

/** Initiales du client, seules autorisées dans un mail : « J. D. », ou les initiales de la raison sociale. */
export function initialesClient(nom: string, prenom: string | null): string {
  const mots = prenom ? [prenom, nom] : nom.split(/\s+/).filter(Boolean).slice(0, 3);
  return mots.map((m) => `${normaliserTexte(m).charAt(0).toUpperCase()}.`).join(' ');
}

/** Fin du numéro de contrat (4 derniers caractères), seule autorisée dans un mail. */
export function finDeContrat(numero: string | null): string {
  if (!numero) {
    return 'sans numéro';
  }
  return numero.length <= 4 ? `…${numero}` : `…${numero.slice(-4)}`;
}
