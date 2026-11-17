import { actionAttendue, estLeMoment, lignesMandataire, raisonDeBlocage, semaineIso } from './emailing';

describe('Mail hebdomadaire du jeudi', () => {
  it('numérote les semaines selon la norme ISO', () => {
    expect(semaineIso('2026-11-26')).toBe('2026-W48');
    expect(semaineIso('2027-01-01')).toBe('2026-W53');
    expect(semaineIso('2027-01-04')).toBe('2027-W01');
  });

  it('part le jeudi à partir de 9 h 01', () => {
    expect(estLeMoment({ jour: 4, heure: '09:00' }, 4, '09:01')).toBe(false);
    expect(estLeMoment({ jour: 4, heure: '09:01' }, 4, '09:01')).toBe(true);
    expect(estLeMoment({ jour: 4, heure: '15:30' }, 4, '09:01')).toBe(true);
    expect(estLeMoment({ jour: 5, heure: '09:01' }, 4, '09:01')).toBe(false);
  });

  it('bloque l’envoi quand une donnée clé paraît incohérente', () => {
    expect(raisonDeBlocage({ dateLimiteDepassee: true, restanteNegative: false, depassementAutorise: false })).toMatch(/date limite/);
    expect(raisonDeBlocage({ dateLimiteDepassee: false, restanteNegative: true, depassementAutorise: false })).toMatch(/négative/);
    expect(raisonDeBlocage({ dateLimiteDepassee: false, restanteNegative: true, depassementAutorise: true })).toBeNull();
  });

  it('cite les réservations par initiales et fin de contrat, avec l’action attendue', () => {
    const lignes = lignesMandataire([
      { numero: 7, statut: 'RENVOYEE', clientNom: 'Durand', clientPrenom: 'Élodie', numeroContrat: '12345678', clientPrevendu: true, motif: 'Numéro de contrat à compléter' },
      { numero: 8, statut: 'SOUMISE', clientNom: 'Martin', clientPrenom: 'Paul', numeroContrat: null, clientPrevendu: false, motif: null },
    ]);
    expect(lignes[1]).toBe('- n° 7 · client E. D. · contrat …5678 : à corriger : Numéro de contrat à compléter');
    expect(lignes[2]).toBe('- n° 8 · client P. M. · contrat sans numéro : client à prévendre');
    expect(lignes.join(' ')).not.toMatch(/Durand|Martin/);
    expect(actionAttendue({ numero: 1, statut: 'LISTE_ATTENTE', clientNom: 'x', clientPrenom: null, numeroContrat: null, clientPrevendu: true, motif: null })).toBe('en liste d’attente');
  });
});
