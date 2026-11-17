import { calculerFiabilite, LigneFiabilite } from './fiabilite';

const maintenant = new Date('2027-02-01T10:00:00Z');
function l(statut: LigneFiabilite['statut'], net: string, autres: Partial<LigneFiabilite> = {}): LigneFiabilite {
  return {
    statut,
    montantNet: net,
    montantValide: null,
    valideeLe: new Date('2026-12-01T10:00:00Z'),
    dateOperation: null,
    annulationTardive: null,
    motifImputable: null,
    ...autres,
  };
}

describe('Indicateurs de fiabilité (section 9)', () => {
  it('plafonne chaque ligne à 100 % : une sur-validation ne compense pas une réservation non honorée', () => {
    const f = calculerFiabilite({
      maintenant,
      lignes: [l('VERIFIEE', '10000', { montantValide: '15000' }), l('LIBEREE', '10000')],
      annulationsPartielles: [],
      prolongations: 0,
    });
    expect(f.tauxRealisation?.toString()).toBe('0.5');
    expect(f.lignesComptees).toBe(2);
    expect(f.nonHonorees.nombre).toBe(1);
    expect(f.nonHonorees.montant.toString()).toBe('10000');
  });

  it('ne compte que les 12 derniers mois et les réservations arrivées à leur terme', () => {
    const f = calculerFiabilite({
      maintenant,
      lignes: [
        l('VERIFIEE', '10000', { montantValide: '9000', valideeLe: new Date('2025-12-01T10:00:00Z') }),
        l('VALIDEE', '10000'),
        l('VERIFIEE', '10000', { montantValide: '9000' }),
      ],
      annulationsPartielles: [],
      prolongations: 0,
    });
    expect(f.lignesComptees).toBe(1);
    expect(f.tauxRealisation?.toString()).toBe('0.9');
  });

  it('distingue les annulations dans les délais et tardives, et écarte celles qui ne sont pas imputables', () => {
    const f = calculerFiabilite({
      maintenant,
      lignes: [
        l('ANNULEE', '5000', { motifImputable: true, annulationTardive: false }),
        l('ANNULEE', '7000', { motifImputable: true, annulationTardive: true }),
        l('ANNULEE', '9000', { motifImputable: false, annulationTardive: true }),
      ],
      annulationsPartielles: [
        { montantRetire: '1000', tardive: true, imputable: true },
        { montantRetire: '2000', tardive: true, imputable: false },
      ],
      prolongations: 2,
    });
    expect(f.annulationsDansLesDelais).toEqual({ nombre: 1, montant: expect.anything() });
    expect(f.annulationsDansLesDelais.montant.toString()).toBe('5000');
    expect(f.annulationsTardives.nombre).toBe(2);
    expect(f.annulationsTardives.montant.toString()).toBe('8000');
    expect(f.lignesComptees).toBe(2);
    expect(f.prolongations).toBe(2);
  });

  it('calcule le délai moyen entre la validation de la réservation et l’opération déclarée', () => {
    const f = calculerFiabilite({
      maintenant,
      lignes: [l('OPERATION_PASSEE', '1', { dateOperation: '2026-12-05' }), l('VERIFIEE', '1', { montantValide: '1', dateOperation: '2026-12-11' })],
      annulationsPartielles: [],
      prolongations: 0,
    });
    expect(f.delaiMoyenJours).toBe(7);
  });

  it('ignore les réservations libérées parce que le produit a été annulé ou reporté', () => {
    const f = calculerFiabilite({ maintenant, lignes: [l('LIBEREE', '10000', { horsFiabilite: true })], annulationsPartielles: [], prolongations: 0 });
    expect(f.lignesComptees).toBe(0);
    expect(f.nonHonorees.nombre).toBe(0);
  });

  it('reste vide tant qu’aucune ligne n’est comptée', () => {
    const f = calculerFiabilite({ maintenant, lignes: [], annulationsPartielles: [], prolongations: 0 });
    expect(f.tauxRealisation).toBeNull();
    expect(f.delaiMoyenJours).toBeNull();
  });
});
