import { ancienneteJours, imputabiliteRetenue, poidsAnnulation } from './annulation';

describe('Annulations : imputabilité et poids (décisions du 18 novembre)', () => {
  it('applique le mode du motif', () => {
    expect(imputabiliteRetenue('IMPUTABLE', { tardive: false, choixBackOffice: null })).toBe(true);
    expect(imputabiliteRetenue('NON_IMPUTABLE', { tardive: true, choixBackOffice: null })).toBe(false);
  });

  it('client qui renonce ou ne répond plus : imputable seulement dans les derniers jours', () => {
    expect(imputabiliteRetenue('SELON_DELAI', { tardive: false, choixBackOffice: null })).toBe(false);
    expect(imputabiliteRetenue('SELON_DELAI', { tardive: true, choixBackOffice: null })).toBe(true);
  });

  it('refus de la compagnie, opération déjà en cours : le back-office tranche', () => {
    expect(imputabiliteRetenue('AU_CHOIX', { tardive: false, choixBackOffice: true })).toBe(true);
    expect(imputabiliteRetenue('AU_CHOIX', { tardive: true, choixBackOffice: false })).toBe(false);
    expect(() => imputabiliteRetenue('AU_CHOIX', { tardive: false, choixBackOffice: null })).toThrow();
  });

  it('compte 1, ou 2 si tardive sur une réservation posée plus de 30 jours avant', () => {
    const base = { seuilAncienneteJours: 30, poidsAggrave: 2 };
    expect(poidsAnnulation({ ...base, imputable: false, tardive: true, ancienneteJours: 60 })).toBe(0);
    expect(poidsAnnulation({ ...base, imputable: true, tardive: false, ancienneteJours: 60 })).toBe(1);
    expect(poidsAnnulation({ ...base, imputable: true, tardive: true, ancienneteJours: 30 })).toBe(1);
    expect(poidsAnnulation({ ...base, imputable: true, tardive: true, ancienneteJours: 31 })).toBe(2);
  });

  it('mesure l’ancienneté en jours de calendrier à Paris', () => {
    expect(ancienneteJours(new Date('2026-11-01T23:30:00Z'), new Date('2026-12-02T10:00:00Z'))).toBe(30);
  });
});
