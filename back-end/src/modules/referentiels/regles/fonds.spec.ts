import { cleFonds, comparerListeFonds, lireCsvFonds } from './fonds';

describe('Import de la liste des fonds (section 6.10)', () => {
  const connus = [
    { id: 'a', cle: 'FR0010315770', nom: 'Fonds Alpha', ouvert: true },
    { id: 'b', cle: cleFonds('Mandat Prudent', null), nom: 'Mandat Prudent', ouvert: true },
    { id: 'c', cle: 'LU0000000001', nom: 'Fonds Gamma', ouvert: false },
    { id: 'd', cle: 'FR0000000002', nom: 'Fonds Delta', ouvert: true },
  ];

  it('ajoute les nouveaux, renomme, rouvre, et ferme les absents sans rien supprimer', () => {
    const r = comparerListeFonds(connus, [
      { nom: 'Fonds Alpha (part C)', isin: 'fr0010315770' },
      { nom: 'Mandat prudent', isin: null },
      { nom: 'Fonds Gamma', isin: 'LU0000000001' },
      { nom: 'Fonds Epsilon', isin: 'FR0000000003' },
    ]);
    expect(r.ajouts).toEqual([{ cle: 'FR0000000003', nom: 'Fonds Epsilon', isin: 'FR0000000003' }]);
    expect(r.renommages).toEqual([
      { id: 'a', ancienNom: 'Fonds Alpha', nouveauNom: 'Fonds Alpha (part C)' },
      { id: 'b', ancienNom: 'Mandat Prudent', nouveauNom: 'Mandat prudent' },
    ]);
    expect(r.reouvertures).toEqual([{ id: 'c', nom: 'Fonds Gamma' }]);
    expect(r.fermetures).toEqual([{ id: 'd', nom: 'Fonds Delta' }]);
  });

  it('signale les doublons du fichier sans les compter deux fois', () => {
    const r = comparerListeFonds([], [
      { nom: 'X', isin: 'FR0000000009' },
      { nom: 'X bis', isin: 'FR0000000009' },
    ]);
    expect(r.ajouts).toHaveLength(1);
    expect(r.doublons).toEqual(['X bis']);
  });

  it('lit un CSV avec ou sans en-tête, au point-virgule ou à la virgule', () => {
    expect(lireCsvFonds('﻿Libellé;Code ISIN\n"Fonds A";FR0000000001\nMandat B;\n')).toEqual([
      { nom: 'Fonds A', isin: 'FR0000000001' },
      { nom: 'Mandat B', isin: null },
    ]);
    expect(lireCsvFonds('Fonds C,LU0000000002')).toEqual([{ nom: 'Fonds C', isin: 'LU0000000002' }]);
  });
});
