import * as fs from 'fs';
import * as path from 'path';
import { calculerCommission, DemandeCalcul, trouverContrat } from './moteur-commission';
import { Referentiel } from './referentiel.types';
import { estimerReprise } from './reprise';

const referentiel: Referentiel = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../prisma/data/referentiel-commissions-2026.json'), 'utf8'),
);

function reprise(cle: string, demande: Omit<DemandeCalcul, 'tauxReversion'>, tauxReversion = 0.7) {
  const complete = { ...demande, tauxReversion };
  const calcul = calculerCommission(referentiel, cle, complete);
  return { calcul, estimation: estimerReprise(trouverContrat(referentiel, cle), complete, calcul) };
}

const montants = (e: { exemples: { mois: number; montant: number }[] }) => e.exemples.map((x) => [x.mois, x.montant]);

describe('Référentiel : règles de reprise', () => {
  it('donne à chaque contrat une règle écrite en clair, avec sa source', () => {
    for (const contrat of referentiel.contrats) {
      expect(contrat.reprise.resume.length).toBeGreaterThan(20);
      expect(contrat.reprise.source.length).toBeGreaterThan(5);
    }
  });
});

describe('Reprise au prorata du temps restant', () => {
  it('Generali : totalité la 1re année, puis mois restants sur 72', () => {
    const { calcul, estimation } = reprise('GENERALI|RETRAITE|GENERALI RETRAITE PRO', { montant: 6000, option: '2,95 %', age: 40 });
    expect(calcul.montantMandataire).toBe(2178);
    // 1 633,50 € au 18e mois : le montant relevé par l'audit des outils de commission (point B1).
    expect(montants(estimation)).toEqual([
      [6, 2178],
      [18, 1633.5],
      [36, 1089],
      [60, 363],
    ]);
  });

  it('Generali à partir de 55 ans : commission linéaire, pas d’exemple de reprise', () => {
    const { estimation } = reprise('GENERALI|RETRAITE|GENERALI RETRAITE PRO', { montant: 6000, option: '2,95 %', age: 58 });
    expect(estimation.exemples).toEqual([]);
    expect(estimation.note).toContain('linéaire');
  });

  it('Swiss Life PER individuel : mois restants sur 48', () => {
    const { estimation } = reprise('SWISSLIFE|RETRAITE|PER INDIVIDUEL', { montant: 6000, frais: 0, partUc: 1 });
    expect(montants(estimation)).toEqual([
      [6, 1124.55],
      [18, 803.25],
      [24, 642.6],
      [36, 321.3],
    ]);
  });

  it('Cardif : mois restants sur 36, le bonus n’est pas repris', () => {
    const { calcul, estimation } = reprise('CARDIF|ASSURANCE VIE|CARDIF ELITE', { montant: 6000, option: '2,75 %', age: 40 });
    expect(calcul.montantMandataire).toBe(1999.2);
    // Part reprenable : 45 % d'escompte sur les 56 % du barème, soit 1 606,50 €.
    expect(montants(estimation)).toEqual([
      [6, 1338.75],
      [18, 803.25],
      [24, 535.5],
    ]);
  });
});

describe('Reprise Abeille, primes périodiques', () => {
  const base = { frais: 0.03, variante: 'AVANCE_5_ANS', remuneration: 'ENCOURS_MAX', partUc: 1, age: 40 };

  it('reprend la base au prorata de la durée d’escompte et la surcommission selon l’année', () => {
    const { calcul, estimation } = reprise('ABEILLE|RETRAITE|RETRAITE PLURIELLE', { ...base, montant: 6000 });
    expect(calcul.composantes.map((c) => c.montant)).toEqual([361.46, 1428]);
    expect(montants(estimation)).toEqual([
      [6, 1753.31], // 361,46 × 54/60 + 1 428 × 100 %
      [18, 1538.22], // 361,46 × 42/60 + 1 428 × 90 %
      [30, 1323.13], // 361,46 × 30/60 + 1 428 × 80 %
      [42, 1108.04], // 361,46 × 18/60 + 1 428 × 70 %
    ]);
  });

  it('ajoute une 5e année à 60 % au-delà de 1 500 € par mois', () => {
    const { calcul, estimation } = reprise('ABEILLE|RETRAITE|RETRAITE PLURIELLE', { ...base, montant: 24000 });
    const [commissionBase, surcommission] = calcul.composantes.map((c) => c.montant);
    expect(estimation.exemples.map((x) => x.mois)).toEqual([6, 18, 30, 42, 54]);
    expect(estimation.exemples[4].montant).toBeCloseTo((commissionBase * 6) / 60 + surcommission * 0.6, 1);
  });

  it('ne reprend plus la base une fois la durée d’escompte passée', () => {
    const { calcul, estimation } = reprise('ABEILLE|RETRAITE|RETRAITE PLURIELLE', { ...base, variante: 'AVANCE_3_ANS', montant: 6000 });
    const surcommission = calcul.composantes[1].montant;
    expect(estimation.exemples[3]).toMatchObject({ mois: 42, montant: Math.round(surcommission * 0.7 * 100) / 100 });
  });

  it('versement unique : seule la surcommission peut être reprise', () => {
    const { estimation } = reprise('ABEILLE|TRANSFERTS/PU/VL|RP/EA', { montant: 100000, frais: 0.007, partUc: 1, age: 40 });
    expect(montants(estimation)).toEqual([
      [6, 2618],
      [18, 2356.2],
      [30, 2094.4],
      [42, 1832.6],
    ]);
  });
});

describe('Reprise en prévoyance', () => {
  it('Alptis en précompte : 100 % de la commission d’apport la 1re année, 50 % la 2e', () => {
    const { calcul, estimation } = reprise('ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', { montant: 1200, option: '30%/10% PRE' });
    expect(calcul.montantMandataire).toBe(186.35);
    // Commission d'apport : 20 points sur les 30 de la 1re année, soit 124,23 €.
    expect(montants(estimation)).toEqual([
      [6, 124.23],
      [18, 62.12],
    ]);
  });

  it('Alptis en linéaire : pas de reprise', () => {
    const { estimation } = reprise('ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', { montant: 1200, option: '15 %' });
    expect(estimation.exemples).toEqual([]);
    expect(estimation.note).toContain('pas de reprise');
  });

  it('Swiss Life prévoyance : commission d’apport reprise pendant 3 ans', () => {
    const { estimation } = reprise('SWISSLIFE|PREVOYANCE|SLPI', { montant: 1200, option: '70%/10%' });
    expect(estimation.exemples.map((x) => x.mois)).toEqual([6, 18, 30]);
    expect(new Set(estimation.exemples.map((x) => x.montant)).size).toBe(1);
    expect(estimation.exemples[0].taux).toBeCloseTo(6 / 7, 3);
  });

  it('April : retrouve l’exemple du protocole, 160 € repris sur 300 € au 12e mois', () => {
    const { estimation } = reprise('APRIL|PREVOYANCE|PRO_PREMIUM', { montant: 1000, option: '30%/10%' });
    expect(estimation.exemples.map((x) => x.mois)).toEqual([6, 12]);
    expect(estimation.exemples[1].taux).toBeCloseTo(160 / 300, 3);
    expect(estimation.exemples[0].taux).toBeCloseTo(230 / 300, 3);
  });

  it('April : ne chiffre pas un précompte dont le protocole ne donne pas l’équivalent linéaire', () => {
    const { estimation } = reprise('APRIL|PREVOYANCE|PRO_PREMIUM', { montant: 1000, option: '15%/15%' });
    expect(estimation.exemples).toEqual([]);
    expect(estimation.note).toContain('équivalent linéaire');
  });

  it('Abeille prévoyance : prorata des primes non payées, la 1re année', () => {
    const { estimation } = reprise('ABEILLE|PREVOYANCE|SENSEO_LIBERAL', { montant: 2400 });
    expect(montants(estimation)).toEqual([
      [3, 792.01],
      [6, 528.01],
      [9, 264],
    ]);
  });
});

describe('Reprise : cas sans chiffrage', () => {
  it('ne donne pas d’exemple quand le cabinet n’a pas la règle', () => {
    const { estimation } = reprise('REPAM|PREVOYANCE|PREV_TNS', { montant: 1200, option: '30 %' });
    expect(estimation.exemples).toEqual([]);
    expect(estimation.regle).toContain('back-office');
  });

  it('ne donne pas d’exemple sur un versement unique sans reprise', () => {
    const { estimation } = reprise('SWISSLIFE|TRANSFERTS/PU/VL|PERIN', { montant: 50000, frais: 0.01, partUc: 1 });
    expect(estimation.exemples).toEqual([]);
    expect(estimation.regle).toContain('Pas de reprise');
  });

  it('ne dépasse jamais ce que le mandataire a reçu', () => {
    for (const contrat of referentiel.contrats.filter((c) => c.saisie === 'LISTE')) {
      const demande = { montant: 1234.56, option: (contrat.options ?? [])[0].code, age: 50, partUc: 0.7 };
      const { calcul, estimation } = reprise(contrat.cle, demande);
      for (const exemple of estimation.exemples) {
        expect(exemple.montant).toBeLessThanOrEqual(calcul.montantMandataire);
        expect(exemple.montant).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('applique au mandataire en co-courtage la même proportion de reprise', () => {
    const sans = reprise('GENERALI|RETRAITE|GENERALI RETRAITE PRO', { montant: 6000, option: '2,95 %', age: 40 });
    const avec = reprise('GENERALI|RETRAITE|GENERALI RETRAITE PRO', { montant: 6000, option: '2,95 %', age: 40, tauxCoCourtage: 0.3 });
    expect(avec.estimation.exemples[1].taux).toBeCloseTo(sans.estimation.exemples[1].taux, 3);
    expect(avec.estimation.exemples[1].montant).toBeLessThan(sans.estimation.exemples[1].montant);
  });
});
