import * as fs from 'fs';
import * as path from 'path';
import { arrondirAuCentime, calculerCommission, DemandeCalcul, ErreurCalcul } from './moteur-commission';
import { ContratReferentiel, Referentiel } from './referentiel.types';

const referentiel: Referentiel = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../prisma/data/referentiel-commissions-2026.json'), 'utf8'),
);

const RETRAITE_PLURIELLE = 'ABEILLE|RETRAITE|RETRAITE PLURIELLE';
const EPARGNE_ACTIVE = 'ABEILLE|ASSURANCE VIE|EPARGNE ACTIVE';
const ALPTIS_PRO_PLUS = 'ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS';
const ABEILLE_VERSEMENT = 'ABEILLE|TRANSFERTS/PU/VL|RP/EA';
const GENERALI = 'GENERALI|RETRAITE|GENERALI RETRAITE PRO';
const CARDIF = 'CARDIF|ASSURANCE VIE|CARDIF ELITE';

/** Le cas que la grille d'origine suppose sans le dire : tout en unités de compte, assuré de 40 ans. */
const CAS_GRILLE = { age: 40, partUc: 1 };

/**
 * Grille de commissions d'origine du cabinet, réécrite à la main à partir du classeur,
 * sans passer par le référentiel. Sert de témoin : le moteur doit donner le même taux.
 * Les constantes ci-dessous sont celles du classeur (85 % × 70 % = 0,595).
 */
function grilleOrigine(cle: string, frais: number, variante?: string): number {
  const [compagnie, famille, contrat] = cle.split('|');
  const part = 0.595;
  if (cle === RETRAITE_PLURIELLE || cle === EPARGNE_ACTIVE) {
    const coefficient = { AVANCE_3_ANS: 3 * 0.88, AVANCE_4_ANS: 4 * 0.84, AVANCE_5_ANS: 5 * 0.81, AVANCE_7_ANS: 7 * 0.75 }[
      variante as string
    ] as number;
    return ((frais - 0.005) * coefficient + 0.4) * part;
  }
  if (cle === 'ABEILLE|TRANSFERTS/PU/VL|RP/EA') return (frais - 0.005 + 0.044) * part;
  if (cle === 'SWISSLIFE|RETRAITE|PER INDIVIDUEL') return (frais + 0.09) * 4 * part;
  if (cle === 'SWISSLIFE|EPARGNE|STRATEGIC PREMIUM / CAPI') return (frais + 0.036) * part;
  if (cle === 'SWISSLIFE|TRANSFERTS/PU/VL|PERIN') return (frais + 0.0325) * part;
  if (cle === 'GENERALI|RETRAITE|GENERALI RETRAITE PRO') {
    return ({ 295: 0.363, 95: 0.238 } as Record<number, number>)[Math.round(frais * 10000)];
  }
  if (cle === 'CARDIF|ASSURANCE VIE|CARDIF ELITE') {
    return ({ 275: 0.3332, 250: 0.3079, 200: 0.2602, 150: 0.2115, 100: 0.1627, 50: 0.1141, 0: 0.0655 } as Record<number, number>)[
      Math.round(frais * 10000)
    ];
  }
  if (cle === 'CARDIF|PU/VL|CARDIF ELITE') return (frais - 0.005) * part;
  if (compagnie === 'ABEILLE' && famille === 'PREVOYANCE') {
    const tranches: Record<string, [number, number]> = {
      SOLUTION_PREVOYANCE_PRO: [0.6, 0.6],
      SENSEO_PREVOYANCE: [0.75, 0.6],
      SENSEO_LIBERAL: [0.85, 0.7],
      SENSEO_MEDICAL_HORS_INF_KINE_MEDECIN: [0.85, 0.7],
      SENSEO_MEDICAL_INF_KINE: [0.35, 0.35],
      SENSEO_MEDICAL_MEDECIN: [0.9, 0.9],
      SENSEO_AGRICOLE: [0.65, 0.5],
      GARANTIE_EMPRUNTEUR_ABEILLE: [0.85, 0.7],
      PROFIL_CLE_ASSOCIES: [0.85, 0.7],
    };
    return tranches[contrat][variante === 'SEUIL_ATTEINT' ? 0 : 1] * 0.87 * part;
  }
  if (cle === 'METLIFE|PREVOYANCE|METLIFE_PREVOYANCE') return (frais + 0.3) * 0.87 * part;
  return frais * 0.87 * part;
}

interface Cas {
  cle: string;
  demande: Omit<DemandeCalcul, 'montant' | 'tauxReversion'>;
  frais: number;
  variante?: string;
}

/** Toutes les combinaisons prévues par le référentiel, contrat par contrat. */
function toutesLesCombinaisons(contrat: ContratReferentiel): Cas[] {
  const cle = contrat.cle;
  if (contrat.mode === 'ESCOMPTE') {
    const cas: Cas[] = [];
    for (const variante of contrat.variantes ?? []) {
      for (const frais of [0.005, 0.01, 0.02, 0.03, 0.045]) {
        cas.push({ cle, frais, variante: variante.code, demande: { frais, variante: variante.code, remuneration: 'ENCOURS_MAX' } });
      }
    }
    return cas;
  }
  if (contrat.mode === 'SEUIL') {
    return (contrat.variantes ?? []).map((v) => ({ cle, frais: 0, variante: v.code, demande: { variante: v.code } }));
  }
  if (contrat.mode === 'BAREME') {
    return (contrat.options ?? []).map((o) => ({ cle, frais: o.frais as number, demande: { option: o.code } }));
  }
  if (contrat.saisie === 'LISTE') {
    return (contrat.options ?? []).map((o) => ({ cle, frais: o.taux as number, demande: { option: o.code } }));
  }
  if (contrat.saisie === 'FRAIS_LIBRES') {
    return [0.005, 0.01, 0.03, contrat.fraisParDefaut ?? 0.02].map((frais) => ({ cle, frais, demande: { frais } }));
  }
  const min = contrat.tauxMin ?? 0;
  const max = contrat.tauxMax ?? 1;
  return [min, (min + max) / 2, max].map((taux) => ({ cle, frais: taux, demande: { taux } }));
}

describe('Référentiel 2026', () => {
  it('contient les 151 contrats de la grille, sans doublon', () => {
    expect(referentiel.contrats).toHaveLength(151);
    expect(new Set(referentiel.contrats.map((c) => c.cle)).size).toBe(151);
  });

  it('ne contient que des taux entre 0 et 100 %', () => {
    for (const contrat of referentiel.contrats) {
      for (const option of contrat.options ?? []) {
        for (const taux of [option.taux, option.frais, option.tauxMandataireReference, ...(option.tauxSuivants ?? [])]) {
          if (taux !== undefined) {
            expect(taux).toBeGreaterThanOrEqual(0);
            expect(taux).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('donne à chaque contrat de quoi être simulé', () => {
    for (const contrat of referentiel.contrats) {
      if (contrat.saisie === 'LISTE') {
        expect(contrat.options?.length).toBeGreaterThan(0);
        expect(new Set(contrat.options?.map((o) => o.code)).size).toBe(contrat.options?.length);
      }
      if (contrat.mode === 'ESCOMPTE' || contrat.mode === 'SEUIL') {
        expect(contrat.variantes?.length).toBeGreaterThan(0);
      }
      if (contrat.mode === 'ESCOMPTE') {
        expect(contrat.remunerations?.map((r) => r.code)).toContain(contrat.remunerationParDefaut);
      }
    }
  });
});

describe('Équivalence avec la grille du cabinet', () => {
  const cas = referentiel.contrats.flatMap(toutesLesCombinaisons);

  it('couvre plus de 600 combinaisons', () => {
    expect(cas.length).toBeGreaterThan(600);
  });

  it('paie le même montant que la grille quand l’affaire est dans le cas que la grille suppose', () => {
    // La grille suppose 100 % d'unités de compte, un assuré jeune et un versement sous le plafond.
    const ecarts: string[] = [];
    for (const c of cas) {
      const contrat = referentiel.contrats.find((x) => x.cle === c.cle) as ContratReferentiel;
      // Sur un million d'euros, un écart d'un centime correspond à un écart de taux de 0,000001 %.
      const montant = contrat.plafondSurcommission ? contrat.plafondSurcommission.montantAnnuel : 1_000_000;
      const attendu = arrondirAuCentime(grilleOrigine(c.cle, c.frais, c.variante) * montant);
      const obtenu = calculerCommission(referentiel, c.cle, { ...c.demande, ...CAS_GRILLE, montant, tauxReversion: 0.7 });
      if (obtenu.montantMandataire !== attendu) {
        ecarts.push(`${c.cle} ${JSON.stringify(c.demande)} : grille ${attendu}, moteur ${obtenu.montantMandataire}`);
      }
    }
    expect(ecarts).toEqual([]);
  });
});

describe('Écarts voulus avec la grille', () => {
  it("ne verse pas de commission de base négative quand les frais sont sous le minimum de la compagnie", () => {
    // La grille calcule (0 % − 0,5 %) × coefficient, donc une base négative. Le moteur la ramène à zéro.
    const resultat = calculerCommission(referentiel, EPARGNE_ACTIVE, {
      ...CAS_GRILLE,
      montant: 6000,
      frais: 0,
      variante: 'AVANCE_5_ANS',
      tauxReversion: 0.7,
    });
    expect(resultat.tauxCompagnie).toBeCloseTo(0.4, 12);
    expect(resultat.avertissements.map((a) => a.code)).toEqual(['FRAIS_SOUS_MINIMUM']);
  });

  it('ne rend jamais une commission négative sur un versement à frais réduits', () => {
    const resultat = calculerCommission(referentiel, 'CARDIF|PU/VL|CARDIF ELITE', {
      montant: 50000,
      frais: 0.002,
      tauxReversion: 0.7,
    });
    expect(resultat.montantMandataire).toBe(0);
    expect(resultat.avertissements.map((a) => a.code)).toEqual(['FRAIS_SOUS_MINIMUM']);
  });

  it('refuse des frais au-delà de 4,75 %, pour qu’un « 3 » tapé à la place de « 3 % » ne passe pas', () => {
    expect(() =>
      calculerCommission(referentiel, RETRAITE_PLURIELLE, {
        ...CAS_GRILLE,
        montant: 6000,
        frais: 0.06,
        variante: 'AVANCE_5_ANS',
        tauxReversion: 0.7,
      }),
    ).toThrow(ErreurCalcul);
  });
});

/*
 * Règles décidées par le cabinet le 12 novembre 2026, que la grille d'origine n'applique pas :
 * surcommission sur la part réelle en unités de compte, pondérations d'âge répercutées au mandataire,
 * plafond Abeille de 2 000 € par mois par client et par type de contrat, bonus Swiss Life sur la part UC.
 * Les montants « perçu par le cabinet » sont ceux de l'audit des outils de commission (points A1, A2, A4, A8).
 */
describe('Abeille, primes périodiques : surcommission selon la part en unités de compte', () => {
  const base = { montant: 6000, frais: 0.03, variante: 'AVANCE_5_ANS', remuneration: 'ENCOURS_MAX', age: 40, tauxReversion: 0.7 };

  it('verse 40 % sur les unités de compte quand tout y est investi', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, partUc: 1 });
    expect(r.montantCabinet).toBe(2556.38);
    expect(r.montantMandataire).toBe(1789.46);
    expect(r.avertissements).toEqual([]);
  });

  it('verse 40 % sur les unités de compte et 4 % sur l’euro au-dessus de 50 %', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, partUc: 0.6 });
    expect(r.tauxCompagnie).toBeCloseTo(0.10125 + 0.256, 12);
    // 0,35725 × 6 000 × 85 % = 1 821,975 €, arrondi au centime supérieur.
    expect(r.montantCabinet).toBe(1821.98);
  });

  it('verse 30 % sur les unités de compte et rien sur l’euro à 50 % ou moins', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, partUc: 0.4 });
    expect(r.montantCabinet).toBe(1128.38);
    expect(r.montantMandataire).toBe(789.86);
    expect(r.avertissements.map((a) => a.code)).toEqual(['PART_UC_SOUS_SEUIL']);
  });

  it('exige la part en unités de compte', () => {
    expect(() => calculerCommission(referentiel, RETRAITE_PLURIELLE, base)).toThrow('unités de compte');
  });
});

describe('Abeille : baisse de la surcommission avec l’âge', () => {
  const base = { montant: 6000, frais: 0.03, variante: 'AVANCE_5_ANS', remuneration: 'ENCOURS_MAX', partUc: 1, tauxReversion: 0.7 };
  const a = (age: number) => calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, age });

  it('ne change rien jusqu’à 57 ans', () => {
    expect(a(57).montantMandataire).toBe(1789.46);
    expect(a(57).avertissements).toEqual([]);
  });

  it('retire un dixième de la surcommission par année entre 57 et 67 ans', () => {
    expect(a(58).tauxCompagnie).toBeCloseTo(0.10125 + 0.36, 12);
    expect(a(62).tauxCompagnie).toBeCloseTo(0.10125 + 0.2, 12);
    expect(a(62).montantMandataire).toBe(1075.46);
    expect(a(66).montantMandataire).toBe(504.26);
    expect(a(62).avertissements.map((x) => x.code)).toEqual(['AGE_SURCOMMISSION_REDUITE']);
  });

  it('ne verse plus de surcommission à partir de 67 ans, la commission de base reste due', () => {
    expect(a(67).montantMandataire).toBe(361.46);
    expect(a(80).montantMandataire).toBe(361.46);
    expect(a(67).avertissements.map((x) => x.code)).toEqual(['AGE_SANS_SURCOMMISSION']);
  });

  it('exige l’âge de l’assuré', () => {
    expect(() => calculerCommission(referentiel, RETRAITE_PLURIELLE, base)).toThrow('âge');
  });
});

describe('Abeille : plafond de 2 000 € par mois, par client et par type de contrat', () => {
  const base = { frais: 0.03, variante: 'AVANCE_5_ANS', remuneration: 'ENCOURS_MAX', ...CAS_GRILLE, tauxReversion: 0.7 };

  it('paie la surcommission en entier jusqu’à 2 000 € par mois', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, montant: 24000 });
    expect(r.tauxCompagnie).toBeCloseTo(0.10125 + 0.4, 12);
    expect(r.avertissements).toEqual([]);
  });

  it('paie 3 000 € par mois sur 2 000 € pour la surcommission, sur 3 000 € pour la commission de base', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, montant: 36000 });
    expect(r.montantCompagnie).toBe(13245); // 10,125 % × 36 000 + 40 % × 24 000
    expect(r.montantCabinet).toBe(11258.25);
    expect(r.avertissements.map((x) => x.code)).toEqual(['PLAFOND_SURCOMMISSION']);
  });

  it('compte les versements déjà en place pour ce client sur le même type de contrat', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, montant: 18000, versementsExistants: 12000 });
    expect(r.montantCompagnie).toBe(6622.5); // 10,125 % × 18 000 + 40 % × 12 000
  });

  it('ne verse plus de surcommission quand le plafond est déjà atteint, sans jamais la rendre négative', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, montant: 6000, versementsExistants: 30000 });
    expect(r.montantCompagnie).toBe(607.5);
  });

  it('traite chaque type de contrat à part : 2 000 € sur un PER et 2 000 € sur une assurance vie passent en entier', () => {
    const per = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, montant: 24000 });
    const vie = calculerCommission(referentiel, EPARGNE_ACTIVE, { ...base, montant: 24000 });
    expect(per.avertissements).toEqual([]);
    expect(vie.avertissements).toEqual([]);
  });

  it('ne plafonne pas un versement unique', () => {
    const r = calculerCommission(referentiel, ABEILLE_VERSEMENT, { ...CAS_GRILLE, montant: 100000, frais: 0.007, tauxReversion: 0.7 });
    expect(r.montantMandataire).toBe(2737);
  });
});

describe('Abeille, versement unique : surcommission selon la part en unités de compte et l’âge', () => {
  const base = { montant: 100000, frais: 0.007, tauxReversion: 0.7 };

  it('verse 3,2 % sur les unités de compte à 40 % ou moins', () => {
    const r = calculerCommission(referentiel, ABEILLE_VERSEMENT, { ...base, age: 40, partUc: 0.3 });
    expect(r.tauxCompagnie).toBeCloseTo(0.002 + 0.0096, 12);
    expect(r.montantMandataire).toBe(690.2);
  });

  it('réduit la surcommission de moitié à 62 ans', () => {
    const r = calculerCommission(referentiel, ABEILLE_VERSEMENT, { ...base, age: 62, partUc: 1 });
    expect(r.montantMandataire).toBe(1428);
  });
});

describe('Swiss Life : bonus payé sur la seule part en unités de compte', () => {
  it('paie le bonus entier du PER individuel à 100 % d’unités de compte, la moitié à 50 %', () => {
    const cle = 'SWISSLIFE|RETRAITE|PER INDIVIDUEL';
    const tout = calculerCommission(referentiel, cle, { montant: 6000, frais: 0, partUc: 1, tauxReversion: 0.7 });
    const moitie = calculerCommission(referentiel, cle, { montant: 6000, frais: 0, partUc: 0.5, tauxReversion: 0.7 });
    expect(tout.montantMandataire).toBe(1285.2);
    expect(moitie.montantMandataire).toBe(642.6);
  });

  it('ajoute les frais au bonus sur Strategic Premium', () => {
    const r = calculerCommission(referentiel, 'SWISSLIFE|EPARGNE|STRATEGIC PREMIUM / CAPI', {
      montant: 50000,
      frais: 0.01,
      partUc: 0.6,
      tauxReversion: 0.7,
    });
    expect(r.tauxCompagnie).toBeCloseTo(0.01 + 0.0216, 12);
    expect(r.montantMandataire).toBe(940.1);
  });

  it('ne demande pas l’âge', () => {
    expect(() =>
      calculerCommission(referentiel, 'SWISSLIFE|TRANSFERTS/PU/VL|PERIN', { montant: 1000, frais: 0.01, partUc: 1, tauxReversion: 0.7 }),
    ).not.toThrow();
  });
});

describe('Generali Retraite Pro : pondération d’âge sur l’escompte', () => {
  const a = (age: number) => calculerCommission(referentiel, GENERALI, { montant: 6000, option: '2,95 %', age, tauxReversion: 0.7 });

  it('paie le barème entier jusqu’à 45 ans', () => {
    expect(a(40).montantMandataire).toBe(2178);
    expect(a(45).montantMandataire).toBe(2178);
  });

  it('réduit l’escompte d’un quinzième par année entre 45 et 54 ans, sans toucher au rappel', () => {
    expect(a(50).montantMandataire).toBe(1749.5);
    expect(a(50).avertissements.map((x) => x.code)).toEqual(['AGE_ESCOMPTE_REDUIT']);
  });

  it('passe à 6 % par an à partir de 55 ans, rappel maintenu', () => {
    expect(a(55).tauxCompagnie).toBeCloseTo(0.31, 12);
    expect(a(55).montantCabinet).toBe(1581); // dont 306 € hors rappel, le montant relevé par l'audit
    expect(a(55).montantMandataire).toBe(1106.7);
  });
});

describe('Cardif Elite : pondération d’âge sur l’escompte, pas sur le bonus', () => {
  const a = (age: number) => calculerCommission(referentiel, CARDIF, { montant: 6000, option: '2,75 %', age, tauxReversion: 0.7 });

  it('paie le barème entier jusqu’à 45 ans', () => {
    expect(a(40).montantMandataire).toBe(1999.2);
  });

  it('réduit l’escompte d’un vingtième par année entre 45 et 65 ans', () => {
    expect(a(55).tauxCompagnie).toBeCloseTo(0.225 + 0.11, 10);
    expect(a(55).montantMandataire).toBe(1195.95);
  });

  it('ne garde que le bonus à partir de 65 ans', () => {
    expect(a(65).montantMandataire).toBe(392.7);
  });
});

describe('Abeille Retraite Plurielle, options de rémunération', () => {
  const base = { ...CAS_GRILLE, montant: 6000, frais: 0.03, variante: 'AVANCE_5_ANS', tauxReversion: 0.7 };

  it('retrouve l’exemple du protocole en Encours Max : 10,12 % sur 5 ans à 3 % de frais', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, remuneration: 'ENCOURS_MAX' });
    expect(r.tauxCompagnie - 0.4).toBeCloseTo(0.10125, 12);
  });

  it('applique les frais entiers en Acquisition Max : 12,15 % sur 5 ans à 3 % de frais', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, remuneration: 'ACQUISITION_MAX' });
    expect(r.tauxCompagnie - 0.4).toBeCloseTo(0.1215, 12);
  });

  it('propose Acquisition Max quand rien n’est précisé', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, base);
    expect(r.remunerationRetenue).toBe('ACQUISITION_MAX');
  });

  it('sépare la commission de base et la surcommission, sans écart d’un centime avec le total', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, { ...base, montant: 6333.33 });
    expect(r.composantes.map((c) => c.code)).toEqual(['BASE', 'SURCOMMISSION']);
    const somme = r.composantes.reduce((total, c) => total + c.montant, 0);
    expect(arrondirAuCentime(somme)).toBe(r.montantMandataire);
  });
});

describe('Chaîne compagnie, cabinet, mandataire', () => {
  const demande = { montant: 1200, option: '30%/10% PRE', tauxReversion: 0.7 };

  it('calcule la prévoyance sur la cotisation hors taxe', () => {
    const r = calculerCommission(referentiel, ALPTIS_PRO_PLUS, demande);
    expect(r.baseHorsTaxe).toBe(true);
    expect(r.baseCalcul).toBe(1044);
    expect(r.montantCompagnie).toBe(313.2);
    expect(r.montantCabinet).toBe(266.22);
    expect(r.montantMandataire).toBe(186.35);
  });

  it('applique le taux de réversion propre au mandataire', () => {
    const a70 = calculerCommission(referentiel, ALPTIS_PRO_PLUS, demande);
    const a80 = calculerCommission(referentiel, ALPTIS_PRO_PLUS, { ...demande, tauxReversion: 0.8 });
    const a90 = calculerCommission(referentiel, ALPTIS_PRO_PLUS, { ...demande, tauxReversion: 0.9 });
    expect(a80.montantMandataire).toBe(212.98);
    expect(a90.montantMandataire).toBe(239.6);
    expect(a80.montantCabinet).toBe(a70.montantCabinet);
  });

  it('ajuste un barème relevé à 70 % au taux de réversion du mandataire', () => {
    const cle = 'GENERALI|RETRAITE|GENERALI RETRAITE PRO';
    const a70 = calculerCommission(referentiel, cle, { montant: 10000, option: '2,95 %', age: 40, tauxReversion: 0.7 });
    const a80 = calculerCommission(referentiel, cle, { montant: 10000, option: '2,95 %', age: 40, tauxReversion: 0.8 });
    expect(a70.montantMandataire).toBe(3630);
    expect(a80.montantMandataire).toBe(4148.57);
  });

  it('choisit la tranche du seuil d’après la cotisation quand elle n’est pas précisée', () => {
    const cle = 'ABEILLE|PREVOYANCE|SENSEO_LIBERAL';
    const sous = calculerCommission(referentiel, cle, { montant: 1900, tauxReversion: 0.7 });
    const dessus = calculerCommission(referentiel, cle, { montant: 2000, tauxReversion: 0.7 });
    expect(sous.varianteRetenue).toBe('SOUS_SEUIL');
    expect(dessus.varianteRetenue).toBe('SEUIL_ATTEINT');
  });
});

describe('Co-courtage avec un cabinet d’expertise comptable', () => {
  const demande = { montant: 1200, option: '30%/10% PRE', tauxReversion: 0.7 };

  it('ne change rien quand il n’y a pas de convention', () => {
    const r = calculerCommission(referentiel, ALPTIS_PRO_PLUS, demande);
    expect([r.tauxCoCourtage, r.montantCoCourtage, r.montantMandataire]).toEqual([0, 0, 186.35]);
  });

  it('verse 30 % de la commission brute de la compagnie au cabinet d’expertise comptable', () => {
    const r = calculerCommission(referentiel, ALPTIS_PRO_PLUS, { ...demande, tauxCoCourtage: 0.3 });
    expect(r.montantCompagnie).toBe(313.2);
    expect(r.montantCoCourtage).toBe(93.96);
    // Soit un peu plus de 35 % de ce que le cabinet reçoit après la retenue du courtier grossiste.
    expect(r.montantCoCourtage / r.montantCabinet).toBeCloseTo(0.3 / 0.85, 3);
  });

  it('paie au mandataire son taux de reversement sur ce qui reste au cabinet', () => {
    const r = calculerCommission(referentiel, ALPTIS_PRO_PLUS, { ...demande, tauxCoCourtage: 0.3 });
    // (85 % − 30 %) × 70 % = 38,5 % de la commission brute, au lieu de 59,5 %.
    expect(r.tauxMandataire / r.tauxCompagnie).toBeCloseTo(0.385, 12);
    expect(r.montantMandataire).toBe(120.58);
  });

  it('accepte un autre taux de convention', () => {
    const r = calculerCommission(referentiel, ALPTIS_PRO_PLUS, { ...demande, tauxCoCourtage: 0.35 });
    expect(r.montantCoCourtage).toBe(109.62);
    expect(r.montantMandataire).toBe(109.62);
  });

  it('s’applique aussi à la surcommission', () => {
    const r = calculerCommission(referentiel, RETRAITE_PLURIELLE, {
      ...CAS_GRILLE,
      montant: 6000,
      frais: 0.03,
      variante: 'AVANCE_5_ANS',
      remuneration: 'ENCOURS_MAX',
      tauxCoCourtage: 0.3,
      tauxReversion: 0.7,
    });
    expect(r.montantCoCourtage).toBe(902.25); // 30 % de 3 007,50 €
    expect(r.montantMandataire).toBe(1157.89); // 3 007,50 € × 55 % × 70 %
    expect(r.composantes.reduce((total, c) => total + c.montant, 0)).toBeCloseTo(1157.89, 2);
  });

  it('refuse un taux de convention supérieur au maximum du référentiel', () => {
    expect(() => calculerCommission(referentiel, ALPTIS_PRO_PLUS, { ...demande, tauxCoCourtage: 0.6 })).toThrow('expertise comptable');
  });
});

describe('Arrondi', () => {
  it('arrondit au centime le plus proche, moitié vers le haut', () => {
    expect(arrondirAuCentime(1.005)).toBe(1.01);
    expect(arrondirAuCentime(186.354)).toBe(186.35);
    expect(arrondirAuCentime(2.675)).toBe(2.68);
    expect(arrondirAuCentime(0)).toBe(0);
  });
});

describe('Demandes refusées', () => {
  const refuse = (cle: string, demande: Partial<DemandeCalcul>, code: string) => {
    try {
      calculerCommission(referentiel, cle, { montant: 1000, tauxReversion: 0.7, ...demande });
    } catch (erreur) {
      expect(erreur).toBeInstanceOf(ErreurCalcul);
      expect((erreur as ErreurCalcul).code).toBe(code);
      return;
    }
    throw new Error('La demande aurait dû être refusée');
  };

  it('refuse un contrat absent du barème', () => refuse('INCONNU|X|Y', {}, 'CONTRAT_INCONNU'));
  it('refuse un montant négatif', () => refuse(ALPTIS_PRO_PLUS, { montant: -1, option: '30%/10% PRE' }, 'MONTANT_INVALIDE'));
  it('refuse une option qui n’existe pas', () => refuse(ALPTIS_PRO_PLUS, { option: '99%' }, 'OPTION_INCONNUE'));
  it('refuse des frais au-delà de la borne du contrat', () =>
    refuse(RETRAITE_PLURIELLE, { ...CAS_GRILLE, frais: 3, variante: 'AVANCE_5_ANS' }, 'FRAIS_INVALIDES'));
  it('refuse un âge qui n’est pas un nombre entier', () =>
    refuse(RETRAITE_PLURIELLE, { frais: 0.03, variante: 'AVANCE_5_ANS', partUc: 1, age: 45.5 }, 'AGE_MANQUANT'));
  it('refuse une part en unités de compte supérieure à 100 %', () =>
    refuse(RETRAITE_PLURIELLE, { frais: 0.03, variante: 'AVANCE_5_ANS', partUc: 1.2, age: 45 }, 'PART_UC_MANQUANTE'));
  it('refuse des versements déjà en place négatifs', () =>
    refuse(
      RETRAITE_PLURIELLE,
      { frais: 0.03, variante: 'AVANCE_5_ANS', partUc: 1, age: 45, versementsExistants: -1 },
      'VERSEMENTS_INVALIDES',
    ));
  it('refuse une durée d’escompte inconnue', () =>
    refuse(RETRAITE_PLURIELLE, { ...CAS_GRILLE, frais: 0.03, variante: 'AVANCE_9_ANS' }, 'VARIANTE_INCONNUE'));
  it('refuse une option de rémunération non prévue pour le contrat', () =>
    refuse(EPARGNE_ACTIVE, { ...CAS_GRILLE, frais: 0.03, variante: 'AVANCE_5_ANS', remuneration: 'ACQUISITION_MAX' }, 'REMUNERATION_INCONNUE'));
  it('refuse un taux saisi hors des bornes du contrat', () =>
    refuse('ZEPHIR|PREVOYANCE|(contrat unique)', { taux: 0.9 }, 'TAUX_INVALIDE'));
  it('refuse un taux de réversion supérieur à 100 %', () =>
    refuse(ALPTIS_PRO_PLUS, { option: '30%/10% PRE', tauxReversion: 1.2 }, 'REVERSION_INVALIDE'));
});
