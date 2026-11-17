import { calculerCompteurs, ReservationCompte, seuilsFranchis, soldeGlobale } from './compteurs';

function r(statut: ReservationCompte['statut'], net: string, valide: string | null = null, globale: string | null = null): ReservationCompte {
  return { statut, montantNet: net, montantValide: valide, source: globale ? 'RESERVATION_GLOBALE' : 'ENVELOPPE', reservationGlobaleId: globale };
}

describe('Double enveloppe (section 6.1)', () => {
  it('déduit le réservé des réservations actives, soumises comprises', () => {
    const c = calculerCompteurs({
      montantInitial: '1000000',
      mouvements: [],
      reservations: [r('SOUMISE', '100000'), r('VALIDEE', '50000'), r('RENVOYEE', '20000'), r('ECHUE', '10000'), r('OPERATION_PASSEE', '5000')],
      globales: [],
    });
    expect(c.restante.toString()).toBe('815000');
    expect(c.reelValide.toString()).toBe('0');
  });

  it('ne déduit ni les refusées, ni les annulées, ni les libérées, ni la liste d’attente', () => {
    const c = calculerCompteurs({
      montantInitial: '1000000',
      mouvements: [],
      reservations: [r('REFUSEE', '1'), r('ANNULEE', '2'), r('LIBEREE', '3'), r('LISTE_ATTENTE', '4'), r('ANNULEE_APRES_OPERATION', '5', '5')],
      globales: [],
    });
    expect(c.restante.toString()).toBe('1000000');
    expect(c.reelValide.toString()).toBe('0');
  });

  it('retient le validé à la place du réservé dès la vérification', () => {
    const c = calculerCompteurs({
      montantInitial: '100000',
      mouvements: [],
      reservations: [r('VERIFIEE', '10000', '15395.21'), r('ECART_A_JUSTIFIER', '20000', '18000')],
      globales: [],
    });
    expect(c.retenu.toString()).toBe('33395.21');
    expect(c.reelValide.toString()).toBe('33395.21');
    expect(c.reelRestant.toString()).toBe('66604.79');
  });

  it('ajoute les rallonges et retire les restitutions de l’enveloppe totale', () => {
    const c = calculerCompteurs({
      montantInitial: '500000',
      mouvements: [
        { type: 'RALLONGE', montant: '200000' },
        { type: 'RESTITUTION', montant: '50000' },
      ],
      reservations: [],
      globales: [],
    });
    expect(c.enveloppeTotale.toString()).toBe('650000');
  });

  it('déduit une réservation globale une seule fois, en entier', () => {
    const c = calculerCompteurs({
      montantInitial: '1000000',
      mouvements: [],
      reservations: [r('SOUMISE', '50000', null, 'g1'), r('VALIDEE', '30000', null, 'g1')],
      globales: [{ id: 'g1', montant: '200000', montantLibere: '0' }],
    });
    expect(c.restante.toString()).toBe('800000');
    expect(soldeGlobale({ id: 'g1', montant: '200000', montantLibere: '0' }, [r('SOUMISE', '50000', null, 'g1')]).solde.toString()).toBe('150000');
  });

  it('déduit à nouveau la seule part qui dépasse le solde de la réservation globale', () => {
    const c = calculerCompteurs({
      montantInitial: '1000000',
      mouvements: [],
      reservations: [r('SOUMISE', '150000', null, 'g1'), r('VERIFIEE', '60000', '70000', 'g1')],
      globales: [{ id: 'g1', montant: '200000', montantLibere: '0' }],
    });
    // Consommé 220 000 pour 200 000 réservés : 20 000 pris sur l'enveloppe globale.
    expect(c.restante.toString()).toBe('780000');
  });

  it('rend à l’enveloppe la part libérée d’une réservation globale', () => {
    const c = calculerCompteurs({
      montantInitial: '1000000',
      mouvements: [],
      reservations: [r('VALIDEE', '50000', null, 'g1')],
      globales: [{ id: 'g1', montant: '200000', montantLibere: '150000' }],
    });
    expect(c.restante.toString()).toBe('950000');
  });

  it('affiche un dépassement autorisé quand l’enveloppe restante est négative', () => {
    const c = calculerCompteurs({ montantInitial: '100000', mouvements: [], reservations: [r('SOUMISE', '120000')], globales: [] });
    expect(c.restante.toString()).toBe('-20000');
    expect(c.depassement.toString()).toBe('20000');
    expect(c.tauxRemplissage.toString()).toBe('1.2');
  });

  it('repère les seuils d’alerte franchis', () => {
    expect(seuilsFranchis('0.85', ['0.8', '1'])).toEqual(['0.8']);
    expect(seuilsFranchis('1', ['0.8', '1'])).toEqual(['0.8', '1']);
    expect(seuilsFranchis('0.5', ['0.8', '1'])).toEqual([]);
  });
});
