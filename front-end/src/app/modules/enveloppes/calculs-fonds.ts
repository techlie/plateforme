/**
 * Arbitrage fonds par fonds saisi en pourcentage de l'encours du contrat (décision du 18 novembre).
 * Même règle que le serveur : montant = pourcentage × encours, arrondi au centime (demi vers le
 * haut) ligne par ligne ; le montant brut est la somme des lignes. Calcul exact en entiers, pour
 * afficher et envoyer exactement ce que le serveur recalcule et contrôle.
 */

/** « 12500.5 » → 1250050 centimes ; null si la saisie n'est pas un montant positif à deux décimales au plus. */
function enCentimes(montant: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(montant);
  if (!m) return null;
  return BigInt(m[1]) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
}

/** « 0.25 » → 250000 millionièmes ; null au-delà de six décimales. */
function enMillioniemes(taux: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(taux);
  if (!m) return null;
  return BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0'));
}

function versTexte(centimes: bigint): string {
  const s = centimes.toString().padStart(3, '0');
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** Montant d'une ligne : taux décimal (« 0.25 ») × encours du contrat (« 50000.00 »), arrondi au centime. */
export function montantDuPourcentage(taux: string, encours: string): string | null {
  const t = enMillioniemes(taux);
  const e = enCentimes(encours);
  if (t === null || e === null) return null;
  return versTexte((t * e + 500_000n) / 1_000_000n);
}

/** Somme exacte de montants « 1234.56 » ; null si l'un d'eux est invalide. */
export function sommeMontants(montants: string[]): string | null {
  let total = 0n;
  for (const m of montants) {
    const c = enCentimes(m);
    if (c === null) return null;
    total += c;
  }
  return versTexte(total);
}
