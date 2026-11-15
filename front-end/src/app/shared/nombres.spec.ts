import { ecrirePourcent, formaterEuros, lireNombre, lirePourcent, normaliser } from './nombres';

describe('Saisie des nombres', () => {
  it('lit les écritures françaises', () => {
    expect(lireNombre('1 200')).toBe(1200);
    expect(lireNombre('1 200,50')).toBe(1200.5);
    expect(lireNombre('1200.5')).toBe(1200.5);
    expect(lireNombre('50 000 €')).toBe(50000);
  });

  it('refuse ce qui n’est pas un nombre positif', () => {
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('abc')).toBeNull();
    expect(lireNombre('-5')).toBeNull();
    expect(lireNombre('1,2,3')).toBeNull();
  });

  it('convertit un pourcentage saisi en taux, sans bruit d’arrondi', () => {
    expect(lirePourcent('3')).toBe(0.03);
    expect(lirePourcent('2,95')).toBe(0.0295);
    expect(lirePourcent('0,7')).toBe(0.007);
    expect(lirePourcent('')).toBeNull();
  });

  it('écrit un taux en pourcentage', () => {
    expect(ecrirePourcent(0.0295)).toBe('2,95');
    expect(ecrirePourcent(0.007)).toBe('0,7');
    expect(ecrirePourcent(0.7)).toBe('70');
  });

  it('écrit les montants en euros à deux décimales', () => {
    expect(formaterEuros(1861.76).replace(/\s/g, ' ')).toBe('1 861,76 €');
    expect(formaterEuros(186.3).replace(/\s/g, ' ')).toBe('186,30 €');
  });

  it('compare les recherches sans accents ni majuscules', () => {
    expect(normaliser('Prévoyance Zéphir')).toBe('prevoyance zephir');
  });
});
