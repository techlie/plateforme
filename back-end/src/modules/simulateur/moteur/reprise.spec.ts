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

  it('reprend toute la commission selon l’année d’arrêt : 100, 90, 80 puis 70 %', () => {
    const { calcul, estimation } = reprise('ABEILLE|RETRAITE|RETRAITE PLURIELLE', { ...base, montant: 6000 });
    expect(calcul.montantMandataire).toBe(1789.46);
    expect(estimation.exemples.map((x) => [x.libelle, x.montant])).toEqual([
      ['1re année', 1789.46],
      ['2e année', 1610.51],
      ['3e année', 1431.57],
      ['4e année', 1252.62],
    ]);
    expect(estimation.note).toContain('pas de reprise la 5e année');
  });

  it('reprend 100 % la 1re année, quel que soit le mois', () => {
    const { estimation } = reprise('ABEILLE|ASSURANCE VIE|EPARGNE ACTIVE', { ...base, montant: 6000 });
    expect(estimation.exemples[0].taux).toBe(1);
  });

  it('ajoute une 5e année à 60 % au-delà de 1 500 € par mois', () => {
    const { calcul, estimation } = reprise('ABEILLE|RETRAITE|RETRAITE PLURIELLE', { ...base, montant: 24000 });
    expect(estimation.exemples.map((x) => x.libelle)).toEqual(['1re année', '2e année', '3e année', '4e année', '5e année']);
    expect(estimation.exemples[4].montant).toBe(Math.round(calcul.montantMandataire * 0.6 * 100) / 100);
    expect(estimation.note).toBeUndefined();
  });

  it('versement unique : règle affichée sans exemple chiffré, en attendant la réponse du cabinet', () => {
    const { estimation } = reprise('ABEILLE|TRANSFERTS/PU/VL|RP/EA', { montant: 100000, frais: 0.007, partUc: 1, age: 40 });
    expect(estimation.exemples).toEqual([]);
    expect(estimation.regle).toContain('30 000 €');
    expect(estimation.aConfirmer.length).toBeGreaterThan(0);
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
    expect(estimation.exemples.map((x) => x.libelle)).toEqual(['1re année', '2e année']);
  });

  it('Alptis en linéaire : pas de reprise', () => {
    const { estimation } = reprise('ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', { montant: 1200, option: '15 %' });
    expect(estimation.exemples).toEqual([]);
    expect(estimation.note).toContain('pas de reprise');
  });

  it('Swiss Life prévoyance : règle affichée sans exemple chiffré, en attendant la réponse du cabinet', () => {
    const { estimation } = reprise('SWISSLIFE|PREVOYANCE|SLPI', { montant: 1200, option: '70%/10%' });
    expect(estimation.exemples).toEqual([]);
    expect(estimation.regle).toContain('3 premières années');
  });

  it('signale sur chaque gamme de prévoyance que la règle vient du protocole de la compagnie', () => {
    for (const cle of ['ALPTIS|PREVOYANCE|SPI_V4', 'APRIL|PREVOYANCE|OBSEQUES', 'ABEILLE|PREVOYANCE|GARANTIE_EMPRUNTEUR_ABEILLE']) {
      const contrat = trouverContrat(referentiel, cle);
      expect(contrat.reprise.aConfirmer?.some((a) => a.includes('à vérifier pour cette gamme'))).toBe(true);
    }
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
