import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Code de connexion à six chiffres, tiré au hasard. */
export function genererCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Jeton aléatoire long, envoyé dans un cookie ou dans un lien. */
export function genererJeton(): string {
  return randomBytes(32).toString('base64url');
}

/** Empreinte d'un jeton aléatoire : c'est elle seule qui est gardée en base. */
export function empreinteJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

/** Empreinte d'un code court, scellée par la clé secrète du serveur. */
export function empreinteCode(code: string, cleSecrete: string): string {
  return createHmac('sha256', cleSecrete).update(code).digest('hex');
}

/** Comparaison à temps constant de deux empreintes. */
export function empreintesEgales(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Adresse partiellement masquée pour l'écran : « j…n@exemple.fr ». */
export function masquerAdresse(email: string): string {
  const [local, domaine] = email.split('@');
  if (!domaine) return email;
  const debut = local.slice(0, 1);
  const fin = local.length > 2 ? local.slice(-1) : '';
  return `${debut}…${fin}@${domaine}`;
}

export function normaliserAdresse(email: string): string {
  return email.trim().toLowerCase();
}
