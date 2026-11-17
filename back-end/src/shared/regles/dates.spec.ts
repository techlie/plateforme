import { calculerEcheance, dateParis, estDateValide, estDepassee, estTardive, jourEtHeureParis, joursRestants, ordreDesDates } from './dates';

describe('Dates des enveloppes, heure de Paris', () => {
  it('une date limite vaut jusqu’à 23 h 59 à Paris', () => {
    // 30 novembre, heure d'hiver : Paris = UTC + 1.
    expect(estDepassee('2026-11-30', new Date('2026-11-30T22:59:59Z'))).toBe(false);
    expect(estDepassee('2026-11-30', new Date('2026-11-30T23:00:00Z'))).toBe(true);
    // Heure d'été : Paris = UTC + 2.
    expect(dateParis(new Date('2026-06-30T21:59:59Z'))).toBe('2026-06-30');
    expect(dateParis(new Date('2026-06-30T22:00:00Z'))).toBe('2026-07-01');
  });

  it('contrôle les dates de calendrier', () => {
    expect(estDateValide('2026-02-29')).toBe(false);
    expect(estDateValide('2028-02-29')).toBe(true);
    expect(estDateValide('29/02/2028')).toBe(false);
  });

  it('impose l’ordre ouverture, date limite interne, fin de commercialisation, clôture produit', () => {
    const ok = { dateOuverture: '2026-11-27', dateLimiteInterne: '2027-01-20', dateFinCommercialisation: '2027-01-25', dateClotureProduit: '2027-01-31' };
    expect(ordreDesDates(ok)).toBeNull();
    expect(ordreDesDates({ ...ok, dateLimiteInterne: '2027-01-26' })).toMatch(/fin de commercialisation/);
    expect(ordreDesDates({ ...ok, dateOuverture: '2027-01-21' })).toMatch(/date limite interne/);
  });

  it('échéance : validation + délai standard, sans dépasser la date limite interne', () => {
    expect(calculerEcheance('2026-12-01', 10, '2027-01-20')).toBe('2026-12-11');
    expect(calculerEcheance('2027-01-15', 10, '2027-01-20')).toBe('2027-01-20');
  });

  it('échéance : tant que le délai standard n’est pas fixé, c’est la date limite interne', () => {
    expect(calculerEcheance('2026-12-01', null, '2027-01-20')).toBe('2027-01-20');
  });

  it('annulation tardive : dans les 15 derniers jours avant la date limite interne', () => {
    expect(joursRestants('2027-01-20', new Date('2027-01-05T10:00:00Z'))).toBe(15);
    expect(estTardive('2027-01-20', new Date('2027-01-05T10:00:00Z'), 15)).toBe(false);
    expect(estTardive('2027-01-20', new Date('2027-01-06T10:00:00Z'), 15)).toBe(true);
    expect(estTardive('2027-01-20', new Date('2027-01-20T20:00:00Z'), 15)).toBe(true);
  });

  it('lit le jour et l’heure à Paris pour le mail du jeudi à 9 h 01', () => {
    expect(jourEtHeureParis(new Date('2026-11-26T08:01:00Z'))).toEqual({ jour: 4, heure: '09:01' });
    expect(jourEtHeureParis(new Date('2026-11-29T23:30:00Z'))).toEqual({ jour: 1, heure: '00:30' });
  });
});
