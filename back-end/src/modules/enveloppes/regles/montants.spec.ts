import { arrondirAuCentime, commission, montantNet, part, somme } from './montants';

describe('Montants des enveloppes', () => {
  it('calcule le net investi : brut moins les frais, arrondi au centime à la fin', () => {
    expect(montantNet('10000', '0.01').toFixed(2)).toBe('9900.00');
    expect(montantNet('15395.55', '0.015').toFixed(2)).toBe('15164.62'); // 15 164,617 → 15 164,62
    expect(montantNet('1500', '0').toFixed(2)).toBe('1500.00');
  });

  it('calcule la commission sur le net : montant × taux', () => {
    expect(commission('9900', '0.02').toFixed(2)).toBe('198.00');
    expect(commission('15164.62', '0.005').toFixed(2)).toBe('75.82'); // 75,8231
  });

  it('reste exact en décimal (pas d’erreur de virgule flottante)', () => {
    expect(somme(['0.1', '0.2']).toString()).toBe('0.3');
    expect(arrondirAuCentime('2.675').toFixed(2)).toBe('2.68');
    expect(arrondirAuCentime('-2.675').toFixed(2)).toBe('-2.68');
  });

  it('donne une part nulle quand le diviseur est nul', () => {
    expect(part('10', '0').toString()).toBe('0');
    expect(part('25', '100').toString()).toBe('0.25');
  });
});
