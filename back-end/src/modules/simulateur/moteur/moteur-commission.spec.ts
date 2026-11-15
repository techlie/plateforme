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

  it('paie le même montant que la grille pour chaque contrat, chaque option et chaque variante', () => {
    // Sur un million d'euros, un écart d'un centime correspond à un écart de taux de 0,000001 %.
    const montant = 1_000_000;
    const ecarts: string[] = [];
    for (const c of cas) {
      const attendu = arrondirAuCentime(grilleOrigine(c.cle, c.frais, c.variante) * montant);
      const obtenu = calculerCommission(referentiel, c.cle, { ...c.demande, montant, tauxReversion: 0.7 });
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
});

describe('Abeille Retraite Plurielle, options de rémunération', () => {
  const base = { montant: 6000, frais: 0.03, variante: 'AVANCE_5_ANS', tauxReversion: 0.7 };

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
    const a70 = calculerCommission(referentiel, cle, { montant: 10000, option: '2,95 %', tauxReversion: 0.7 });
    const a80 = calculerCommission(referentiel, cle, { montant: 10000, option: '2,95 %', tauxReversion: 0.8 });
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
  it('refuse des frais au-delà de 100 %', () =>
    refuse(RETRAITE_PLURIELLE, { frais: 3, variante: 'AVANCE_5_ANS' }, 'FRAIS_INVALIDES'));
  it('refuse une durée d’escompte inconnue', () =>
    refuse(RETRAITE_PLURIELLE, { frais: 0.03, variante: 'AVANCE_9_ANS' }, 'VARIANTE_INCONNUE'));
  it('refuse une option de rémunération non prévue pour le contrat', () =>
    refuse(EPARGNE_ACTIVE, { frais: 0.03, variante: 'AVANCE_5_ANS', remuneration: 'ACQUISITION_MAX' }, 'REMUNERATION_INCONNUE'));
  it('refuse un taux saisi hors des bornes du contrat', () =>
    refuse('ZEPHIR|PREVOYANCE|(contrat unique)', { taux: 0.9 }, 'TAUX_INVALIDE'));
  it('refuse un taux de réversion supérieur à 100 %', () =>
    refuse(ALPTIS_PRO_PLUS, { option: '30%/10% PRE', tauxReversion: 1.2 }, 'REVERSION_INVALIDE'));
});
