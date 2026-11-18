import { montantDuPourcentage, sommeMontants } from './calculs-fonds';

describe('Fonds saisis en pourcentage de l’encours du contrat', () => {
  it('calcule le montant de chaque ligne, arrondi au centime comme le serveur', () => {
    expect(montantDuPourcentage('0.25', '50000.00')).toBe('12500.00');
    expect(montantDuPourcentage('0.333333', '1000.00')).toBe('333.33');
    // Demi-centime : arrondi vers le haut.
    expect(montantDuPourcentage('0.5', '0.01')).toBe('0.01');
    expect(montantDuPourcentage('0.125', '0.12')).toBe('0.02');
    expect(montantDuPourcentage('0.1', 'abc')).toBeNull();
  });

  it('additionne exactement, sans erreur d’arrondi', () => {
    expect(sommeMontants(['0.10', '0.20'])).toBe('0.30');
    expect(sommeMontants(['12500.00', '333.33', '0.07'])).toBe('12833.40');
    expect(sommeMontants([])).toBe('0.00');
  });
});
