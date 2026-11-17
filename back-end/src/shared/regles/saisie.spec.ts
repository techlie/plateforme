import { cleClient, finDeContrat, initialesClient, isinValide, nettoyerNumeroContrat, normaliserTexte, numeroConforme } from './saisie';

describe('Règles de saisie', () => {
  it('retire espaces et retours à la ligne du numéro de contrat', () => {
    expect(nettoyerNumeroContrat(' 12 345\n678 ')).toBe('12345678');
  });

  it('contrôle le format seulement quand la compagnie en a un', () => {
    expect(numeroConforme('12345678', null)).toBe(true);
    expect(numeroConforme('', null)).toBe(false);
    expect(numeroConforme('12345678', '\\d{8}')).toBe(true);
    expect(numeroConforme('1234567', '\\d{8}')).toBe(false);
    expect(numeroConforme('12345678X', '\\d{8}')).toBe(false);
  });

  it('vérifie le code ISIN, clé de contrôle comprise', () => {
    expect(isinValide('US0378331005')).toBe(true);
    expect(isinValide('GB0002634946')).toBe(true);
    expect(isinValide('AU0000XVGZA3')).toBe(true);
    expect(isinValide('us0378331005')).toBe(true);
    expect(isinValide('US0378331006')).toBe(false);
    expect(isinValide('US037833100')).toBe(false);
  });

  it('normalise sans accents, majuscules ni ponctuation', () => {
    expect(normaliserTexte('R-co Valor « Équilibre »')).toBe('r co valor equilibre');
    expect(cleClient('Dupont-Martin', 'Élodie')).toBe(cleClient('DUPONT MARTIN', 'elodie'));
  });

  it('ne livre dans un mail que les initiales et la fin du numéro de contrat', () => {
    expect(initialesClient('Durand', 'Élodie')).toBe('E. D.');
    expect(initialesClient('Société Exemple Conseil', null)).toBe('S. E. C.');
    expect(finDeContrat('ABC123456789')).toBe('…6789');
    expect(finDeContrat(null)).toBe('sans numéro');
  });
});
