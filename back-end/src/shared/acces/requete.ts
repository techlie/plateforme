import type { Request } from 'express';

export const NOM_COOKIE_SESSION = 'sr_session';

/** Lit un cookie dans l'en-tête de la demande, sans dépendance supplémentaire. */
export function lireCookie(requete: Request, nom: string): string | undefined {
  const entete = requete.headers.cookie;
  if (!entete) return undefined;
  for (const morceau of entete.split(';')) {
    const position = morceau.indexOf('=');
    if (position < 0) continue;
    if (morceau.slice(0, position).trim() === nom) {
      return decodeURIComponent(morceau.slice(position + 1).trim());
    }
  }
  return undefined;
}

export function origineDemande(requete: Request): { adresseIp: string | null; navigateur: string | null } {
  return {
    adresseIp: requete.ip ?? null,
    navigateur: (requete.headers['user-agent'] ?? '').slice(0, 300) || null,
  };
}
