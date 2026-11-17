import { normaliserTexte } from '../../../shared/regles/saisie';

/**
 * Import d'une liste de fonds d'une compagnie (section 6.10). Fonction pure : elle dit ce qui
 * change, le service l'applique.
 * - Clé : l'ISIN quand il existe, sinon le nom normalisé.
 * - Fonds nouveau : ajouté. Fonds connu : nom mis à jour si besoin, l'ancien nom gardé.
 * - Fonds absent de la nouvelle liste : jamais supprimé, il passe « fermé à l'investissement ».
 * - Fonds fermé qui réapparaît : rouvert.
 */
export interface FondsConnu {
  id: string;
  cle: string;
  nom: string;
  ouvert: boolean;
}

export interface LigneImport {
  nom: string;
  isin: string | null;
}

export interface ResultatImport {
  ajouts: { cle: string; nom: string; isin: string | null }[];
  renommages: { id: string; ancienNom: string; nouveauNom: string }[];
  fermetures: { id: string; nom: string }[];
  reouvertures: { id: string; nom: string }[];
  doublons: string[];
}

export function cleFonds(nom: string, isin: string | null): string {
  return isin ? isin.trim().toUpperCase() : `nom:${normaliserTexte(nom)}`;
}

export function comparerListeFonds(connus: FondsConnu[], lignes: LigneImport[]): ResultatImport {
  const resultat: ResultatImport = { ajouts: [], renommages: [], fermetures: [], reouvertures: [], doublons: [] };
  const parCle = new Map(connus.map((f) => [f.cle, f]));
  const vues = new Set<string>();

  for (const ligne of lignes) {
    const nom = ligne.nom.trim();
    const isin = ligne.isin?.trim().toUpperCase() || null;
    const cle = cleFonds(nom, isin);
    if (vues.has(cle)) {
      resultat.doublons.push(nom);
      continue;
    }
    vues.add(cle);
    const connu = parCle.get(cle);
    if (!connu) {
      resultat.ajouts.push({ cle, nom, isin });
      continue;
    }
    if (connu.nom !== nom) {
      resultat.renommages.push({ id: connu.id, ancienNom: connu.nom, nouveauNom: nom });
    }
    if (!connu.ouvert) {
      resultat.reouvertures.push({ id: connu.id, nom });
    }
  }

  for (const f of connus) {
    if (f.ouvert && !vues.has(f.cle)) {
      resultat.fermetures.push({ id: f.id, nom: f.nom });
    }
  }
  return resultat;
}

/** Lit un fichier CSV « nom ; ISIN » (séparateur point-virgule ou virgule, ligne d'en-tête facultative). */
export function lireCsvFonds(contenu: string): LigneImport[] {
  const lignes = contenu.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length === 0) {
    return [];
  }
  const separateur = lignes[0].includes(';') ? ';' : ',';
  const cellules = (l: string) => l.split(separateur).map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim());
  const premiere = cellules(lignes[0]);
  const entete = premiere.map((c) => normaliserTexte(c));
  // Une ligne d'en-tête ne contient pas de code ISIN et nomme ses colonnes.
  const aEntete =
    !premiere.some((c) => /^[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]$/.test(c)) &&
    entete.some((c) => c.includes('isin') || ['nom', 'fonds', 'libelle', 'support', 'nom du fonds'].includes(c));
  const colIsin = aEntete ? entete.findIndex((c) => c.includes('isin')) : 1;
  const colNom = aEntete ? entete.findIndex((c) => !c.includes('isin')) : 0;
  return (aEntete ? lignes.slice(1) : lignes)
    .map(cellules)
    .map((c) => ({ nom: c[colNom] ?? '', isin: colIsin >= 0 ? c[colIsin] || null : null }))
    .filter((l) => l.nom);
}
