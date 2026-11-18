import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';

/**
 * Fiche des valeurs à reporter sur l'avenant de la compagnie (section 6.12). Tant que les champs
 * de l'avenant de chaque compagnie ne sont pas repérés, la plateforme fournit cette fiche à la
 * place de l'avenant rempli. Elle est produite seulement après la déclaration de l'accord du client.
 */
export interface DonneesAvenant {
  compagnie: string;
  produit: string;
  isinProduit: string | null;
  typeClient: 'PHYSIQUE' | 'MORALE';
  clientNom: string;
  clientPrenom: string | null;
  numeroContrat: string | null;
  montantNet: string;
  modeArbitrage: 'GLOBAL' | 'PAR_FONDS' | null;
  pourcentageArbitrage: string | null;
  fonds: { nom: string; isin: string | null; montant: string; pourcentage?: string | null }[];
  apporteur: string;
  codeApporteur: string | null;
  date: string;
  version: number;
  numeroReservation: number;
}

function euros(montant: string): string {
  const [entier, decimales = '00'] = Number(montant).toFixed(2).split('.');
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${decimales} €`;
}

function pourcent(taux: string): string {
  return `${(Number(taux) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 4 }).replace(/[  ]/g, ' ')} %`;
}

function dateFr(iso: string): string {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

/** Les valeurs de la fiche, dans l'ordre de l'avenant : client, contrat, produit, montant, fonds, apporteur, date. */
export function valeursAvenant(x: DonneesAvenant): [string, string][] {
  const lignes: [string, string][] = [
    [x.typeClient === 'MORALE' ? 'Souscripteur (raison sociale)' : 'Souscripteur', [x.clientNom.toUpperCase(), x.clientPrenom].filter(Boolean).join(' ')],
    ['Numéro de contrat', x.numeroContrat ?? 'à compléter (affaire nouvelle)'],
    ['Produit', x.produit],
    ['Code ISIN du produit', x.isinProduit ?? 'non renseigné'],
    ['Montant net à investir', euros(x.montantNet)],
  ];
  if (x.modeArbitrage === 'GLOBAL' && x.pourcentageArbitrage) {
    lignes.push(['Désinvestissement', `${pourcent(x.pourcentageArbitrage)} du contrat, au prorata des supports`]);
  }
  if (x.modeArbitrage === 'PAR_FONDS') {
    x.fonds.forEach((f, i) =>
      lignes.push([
        `Fonds à désinvestir ${i + 1}`,
        `${f.nom}${f.isin ? ` (${f.isin})` : ''} : ${f.pourcentage ? `${pourcent(f.pourcentage)} de l’encours du contrat, soit ${euros(f.montant)}` : euros(f.montant)}`,
      ]),
    );
  }
  lignes.push(['Apporteur', x.apporteur], ['Code apporteur', x.codeApporteur ?? 'non renseigné'], ['Date', dateFr(x.date)]);
  return lignes;
}

/** Texte accepté par les polices standard du PDF (pas d'espace fine insécable). */
function texte(t: string): string {
  return t.replace(/[  ]/g, ' ').replace(/[‘’]/g, "'");
}

function couper(t: string, police: PDFFont, taille: number, largeur: number): string[] {
  const mots = texte(t).split(' ');
  const lignes: string[] = [];
  let courante = '';
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (police.widthOfTextAtSize(essai, taille) > largeur && courante) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = essai;
    }
  }
  lignes.push(courante);
  return lignes;
}

export async function ficheAvenantPdf(x: DonneesAvenant): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Fiche des valeurs à reporter - réservation ${x.numeroReservation}`);
  pdf.setAuthor('SR CONSEIL');
  pdf.setCreator('Plateforme SR CONSEIL');
  const page = pdf.addPage([595.28, 841.89]);
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grasse = await pdf.embedFont(StandardFonts.HelveticaBold);
  const encre = rgb(0.17, 0.15, 0.14);
  const discret = rgb(0.43, 0.36, 0.33);
  const marge = 56;
  let y = 841.89 - marge;

  page.drawText('SR CONSEIL', { x: marge, y, size: 16, font: grasse, color: discret });
  y -= 30;
  page.drawText(texte('Fiche des valeurs à reporter sur l’avenant'), { x: marge, y, size: 15, font: grasse, color: encre });
  y -= 18;
  page.drawText(texte(`${x.compagnie} · ${x.produit}`), { x: marge, y, size: 11, font: normale, color: discret });
  y -= 14;
  page.drawText(texte(`Réservation n° ${x.numeroReservation} · version ${x.version} · produite le ${dateFr(x.date)}`), { x: marge, y, size: 9, font: normale, color: discret });
  y -= 30;

  const colonne = 190;
  for (const [libelle, valeur] of valeursAvenant(x)) {
    const lignes = couper(valeur, grasse, 11, 595.28 - marge * 2 - colonne);
    page.drawText(texte(libelle), { x: marge, y, size: 10, font: normale, color: discret });
    lignes.forEach((ligne, i) => page.drawText(ligne, { x: marge + colonne, y: y - i * 14, size: 11, font: grasse, color: encre }));
    y -= 14 * lignes.length + 10;
    page.drawLine({ start: { x: marge, y: y + 4 }, end: { x: 595.28 - marge, y: y + 4 }, thickness: 0.4, color: rgb(0.85, 0.82, 0.8) });
    y -= 6;
  }

  y -= 16;
  for (const ligne of [
    'Reportez ces valeurs sur l’avenant de la compagnie, puis faites-le signer selon le circuit de la compagnie.',
    'La plateforme ne signe rien. Si la réservation est modifiée, cette fiche est périmée : téléchargez la nouvelle version.',
    'Document interne, non contractuel, à ne pas remettre au client.',
  ]) {
    for (const morceau of couper(ligne, normale, 9, 595.28 - marge * 2)) {
      page.drawText(morceau, { x: marge, y, size: 9, font: normale, color: discret });
      y -= 12;
    }
  }
  return pdf.save();
}
