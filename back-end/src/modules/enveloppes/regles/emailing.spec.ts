import { actionAttendue, estDansLesRelancesRapprochees, estLeMoment, lignesAlerteBackOffice, lignesMandataire, raisonDeBlocage, semaineIso } from './emailing';

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

  it('cite les réservations par initiales et fin de contrat, avec l’action attendue, puis le lien', () => {
    const lignes = lignesMandataire(
      [
        { numero: 7, statut: 'RENVOYEE', clientNom: 'Durand', clientPrenom: 'Élodie', numeroContrat: '12345678', clientPrevendu: true, motif: 'Numéro de contrat à compléter' },
        { numero: 8, statut: 'SOUMISE', clientNom: 'Martin', clientPrenom: 'Paul', numeroContrat: null, clientPrevendu: false, motif: null },
        { numero: 9, statut: 'OPERATION_PASSEE', clientNom: 'Petit', clientPrenom: 'Jean', numeroContrat: '87654321', clientPrevendu: true, motif: null },
      ],
      { avecFait: true, lien: 'https://plateforme/enveloppes/x' },
    );
    expect(lignes).toEqual([
      'Ce qu’il vous reste à faire :',
      '- n° 7 · client E. D. · contrat …5678 : à corriger : Numéro de contrat à compléter',
      '- n° 8 · client P. M. · contrat sans numéro : client à prévendre',
      '',
      'Ce qui est fait :',
      '- n° 9 · client J. P. · contrat …4321 : opération déclarée, vérification par la compagnie en cours',
      '',
      'Pour avancer, mettez à jour vos réservations sur la plateforme, avec votre identifiant et votre mot de passe : https://plateforme/enveloppes/x',
    ]);
    expect(lignes.join(' ')).not.toMatch(/Durand|Martin|Petit/);
    expect(actionAttendue({ numero: 1, statut: 'LISTE_ATTENTE', clientNom: 'x', clientPrenom: null, numeroContrat: null, clientPrevendu: true, motif: null })).toBe('en liste d’attente');
  });

  it('le lundi, seulement ce qui reste à faire', () => {
    const lignes = lignesMandataire(
      [
        { numero: 3, statut: 'VALIDEE', clientNom: 'Roux', clientPrenom: 'Lia', numeroContrat: '11112222', clientPrevendu: true, motif: null },
        { numero: 4, statut: 'VERIFIEE', clientNom: 'Blanc', clientPrenom: 'Max', numeroContrat: '33334444', clientPrevendu: true, motif: null },
      ],
      { avecFait: false, lien: 'L' },
    );
    expect(lignes.join('\n')).not.toContain('Ce qui est fait');
    expect(lignes[1]).toBe('- n° 3 · client L. R. · contrat …2222 : validée : opération à passer, puis à déclarer sur la plateforme');
    expect(lignesMandataire([], { avecFait: true, lien: 'L' })).toEqual(['Vous n’avez pas de réservation sur cette enveloppe.']);
  });

  it('deux récapitulatifs par semaine à partir de 20 jours de la date limite interne', () => {
    expect(estDansLesRelancesRapprochees(21, 20)).toBe(false);
    expect(estDansLesRelancesRapprochees(20, 20)).toBe(true);
    expect(estDansLesRelancesRapprochees(0, 20)).toBe(true);
    expect(estDansLesRelancesRapprochees(-1, 20)).toBe(false);
  });

  it('alerte le back-office par mandataire, initiales seulement', () => {
    const lignes = lignesAlerteBackOffice([
      { mandataire: 'Marc Essai', reservations: [{ numero: 5, statut: 'SOUMISE', clientNom: 'Durand', clientPrenom: 'Élodie', numeroContrat: '12345678', clientPrevendu: false, motif: null }] },
      { mandataire: 'Maud Essai', reservations: [] },
    ]);
    expect(lignes).toEqual(['', 'Marc Essai :', '- n° 5 · client E. D. · contrat …5678 : client à prévendre']);
  });
});
