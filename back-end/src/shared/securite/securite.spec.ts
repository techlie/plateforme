import { empreinteCode, empreintesEgales, empreinteJeton, genererCode, genererJeton, masquerAdresse, normaliserAdresse } from './securite';

describe('outils de sécurité', () => {
  it('produit des codes de six chiffres', () => {
    for (let i = 0; i < 200; i++) {
      expect(genererCode()).toMatch(/^\d{6}$/);
    }
  });

  it('produit des jetons longs et différents', () => {
    const a = genererJeton();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(genererJeton()).not.toBe(a);
  });

  it("ne garde qu'une empreinte, qui dépend de la clé pour les codes", () => {
    expect(empreinteJeton('abc')).toHaveLength(64);
    expect(empreinteCode('123456', 'cle-1')).not.toBe(empreinteCode('123456', 'cle-2'));
    expect(empreintesEgales(empreinteCode('1', 'k'), empreinteCode('1', 'k'))).toBe(true);
    expect(empreintesEgales(empreinteCode('1', 'k'), empreinteCode('2', 'k'))).toBe(false);
  });

  it("masque l'adresse affichée et la normalise à la saisie", () => {
    expect(masquerAdresse('jean.martin@exemple.fr')).toBe('j…n@exemple.fr');
    expect(masquerAdresse('jo@exemple.fr')).toBe('j…@exemple.fr');
    expect(normaliserAdresse('  Jean@Exemple.FR ')).toBe('jean@exemple.fr');
  });
});
