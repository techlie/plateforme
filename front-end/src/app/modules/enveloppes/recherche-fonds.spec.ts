import { correspond, rechercherFonds } from './recherche-fonds';

describe('Recherche prédictive des fonds', () => {
  const fonds = [
    { id: '1', nom: 'R-co Valor', isin: 'FR0011253624', ouvert: true },
    { id: '2', nom: 'Rendement Corporate', isin: null, ouvert: false },
    { id: '3', nom: 'Carmignac Patrimoine', isin: 'FR0010135103', ouvert: true },
    { id: '4', nom: 'Échiquier Agenor', isin: 'FR0010321810', ouvert: true },
  ];

  it('ignore majuscules, accents et ponctuation : « r co » trouve « R-co »', () => {
    expect(correspond(fonds[0], 'r co')).toBeTrue();
    expect(correspond(fonds[3], 'echiq')).toBeTrue();
  });

  it('chaque mot tapé correspond au début d’un mot, dans n’importe quel ordre', () => {
    expect(correspond(fonds[1], 'r co')).toBeTrue();
    expect(correspond(fonds[1], 'corp rend')).toBeTrue();
    expect(correspond(fonds[2], 'r')).toBeFalse();
  });

  it('cherche aussi par code ISIN', () => {
    expect(rechercherFonds(fonds, 'fr00101').map((f) => f.id)).toEqual(['3']);
  });

  it('propose les fonds ouverts avant les fermés, sans ceux déjà choisis', () => {
    expect(rechercherFonds(fonds, 'r co').map((f) => f.id)).toEqual(['1', '2']);
    expect(rechercherFonds(fonds, 'r co', ['1']).map((f) => f.id)).toEqual(['2']);
  });
});
