import { DonneesAvenant, ficheAvenantPdf, valeursAvenant } from './fiche-avenant';

const base: DonneesAvenant = {
  compagnie: 'Compagnie Exemple',
  produit: 'Produit Essai Décembre 2026',
  isinProduit: 'FR0000000000',
  typeClient: 'PHYSIQUE',
  clientNom: 'Durand',
  clientPrenom: 'Élodie',
  numeroContrat: '12345678',
  montantNet: '14850',
  modeArbitrage: 'PAR_FONDS',
  pourcentageArbitrage: null,
  fonds: [
    { nom: 'Fonds Alpha', isin: 'FR0010315770', montant: '10000' },
    { nom: 'Mandat Prudent', isin: null, montant: '4850' },
  ],
  apporteur: 'Jean Essai',
  codeApporteur: 'AP-001',
  date: '2026-12-03',
  version: 2,
  numeroReservation: 42,
};

describe('Fiche des valeurs à reporter sur l’avenant', () => {
  it('reprend les champs prévus : client, contrat, produit et ISIN, montant net, fonds, apporteur et code, date', () => {
    expect(valeursAvenant(base)).toEqual([
      ['Souscripteur', 'DURAND Élodie'],
      ['Numéro de contrat', '12345678'],
      ['Produit', 'Produit Essai Décembre 2026'],
      ['Code ISIN du produit', 'FR0000000000'],
      ['Montant net à investir', '14 850,00 €'],
      ['Fonds à désinvestir 1', 'Fonds Alpha (FR0010315770) : 10 000,00 €'],
      ['Fonds à désinvestir 2', 'Mandat Prudent : 4 850,00 €'],
      ['Apporteur', 'Jean Essai'],
      ['Code apporteur', 'AP-001'],
      ['Date', '03/12/2026'],
    ]);
  });

  it('décrit un arbitrage global en pourcentage du contrat', () => {
    const v = valeursAvenant({ ...base, modeArbitrage: 'GLOBAL', pourcentageArbitrage: '0.15', fonds: [] });
    expect(v).toContainEqual(['Désinvestissement', '15 % du contrat, au prorata des supports']);
  });

  it('reprend un désinvestissement saisi en pourcentage de l’encours du contrat', () => {
    const v = valeursAvenant({ ...base, fonds: [{ nom: 'Fonds Alpha', isin: null, montant: '12500', pourcentage: '0.25' }] });
    expect(v).toContainEqual(['Fonds à désinvestir 1', 'Fonds Alpha : 25 % de l’encours du contrat, soit 12 500,00 €']);
  });

  it('produit un PDF lisible', async () => {
    const octets = await ficheAvenantPdf(base);
    expect(Buffer.from(octets.slice(0, 5)).toString()).toBe('%PDF-');
  });
});
