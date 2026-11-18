import { controlerReservation, EntreeControle } from './controles';

function entree(modif: Partial<EntreeControle['reservation']> = {}, autres: Partial<EntreeControle> = {}, env: Partial<EntreeControle['enveloppe']> = {}): EntreeControle {
  return {
    maintenant: new Date('2026-12-01T10:00:00Z'),
    enveloppe: {
      statut: 'OUVERTE',
      dateLimiteInterne: '2027-01-20',
      montantMinimum: '1500',
      seuilConcentration: '0.15',
      gammesExclues: [{ id: 'g-exclue', nom: 'Ancienne gamme' }],
      formatNumeroContrat: '99999999',
      compagnieAGammes: true,
      ...env,
    },
    reservation: {
      typeOperation: 'VERSEMENT_LIBRE',
      numeroContrat: '12345678',
      montantBrut: '10000',
      montantNet: '10000',
      encoursClient: '200000',
      gammeId: 'g-ok',
      codeApporteurValide: true,
      modeArbitrage: null,
      pourcentageArbitrage: null,
      valeurContrat: null,
      fonds: [],
      ...modif,
    },
    restante: '500000',
    soldeGlobale: null,
    cumulClientAutres: '0',
    doublon: null,
    seuilEstimationArbitrage: '0.05',
    ...autres,
  };
}

const codes = (l: { code: string }[]) => l.map((c) => c.code);

describe('Contrôles à la saisie d’une réservation (section 6.3)', () => {
  it('laisse passer une réservation conforme', () => {
    const r = controlerReservation(entree());
    expect(r.bloquants).toEqual([]);
    expect(r.derogeables).toEqual([]);
    expect(r.alertes).toEqual([]);
    expect(r.partEncours?.toString()).toBe('0.05');
  });

  it('bloque un doublon et renvoie vers la réservation existante', () => {
    const r = controlerReservation(entree({}, { doublon: { numero: 42 } }));
    expect(codes(r.bloquants)).toEqual(['DOUBLON']);
    expect(r.bloquants[0].message).toContain('n° 42');
  });

  it('exige le numéro de contrat, sauf pour une affaire nouvelle', () => {
    expect(codes(controlerReservation(entree({ numeroContrat: null })).bloquants)).toEqual(['CONTRAT_ABSENT']);
    expect(controlerReservation(entree({ numeroContrat: null, typeOperation: 'AFFAIRE_NOUVELLE' })).bloquants).toEqual([]);
  });

  it('numéro hors format : bloquant, dérogation possible ; pas de contrôle tant que le format est inconnu', () => {
    expect(codes(controlerReservation(entree({ numeroContrat: '1234' })).derogeables)).toEqual(['FORMAT_CONTRAT']);
    expect(controlerReservation(entree({ numeroContrat: '1234' }, {}, { formatNumeroContrat: null })).derogeables).toEqual([]);
  });

  it('gamme exclue : bloquant, sans dérogation', () => {
    const r = controlerReservation(entree({ gammeId: 'g-exclue' }));
    expect(codes(r.bloquants)).toEqual(['GAMME_EXCLUE']);
    expect(r.bloquants[0].message).toContain('Ancienne gamme');
  });

  it('code apporteur non valable : bloquant', () => {
    expect(codes(controlerReservation(entree({ codeApporteurValide: false })).bloquants)).toEqual(['CODE_APPORTEUR']);
  });

  it('montant net sous le minimum de l’enveloppe : bloquant', () => {
    expect(codes(controlerReservation(entree({ montantNet: '1499.99' })).bloquants)).toEqual(['MINIMUM']);
    expect(controlerReservation(entree({ montantNet: '1500' })).bloquants).toEqual([]);
  });

  it('arbitrage fonds par fonds : liste obligatoire, total égal au montant brut', () => {
    const base = { typeOperation: 'ARBITRAGE' as const, modeArbitrage: 'PAR_FONDS' as const };
    expect(codes(controlerReservation(entree(base)).bloquants)).toEqual(['FONDS_ABSENTS']);
    const ecart = controlerReservation(entree({ ...base, fonds: [{ montant: '6000' }, { montant: '3000' }] }));
    expect(codes(ecart.bloquants)).toEqual(['FONDS_TOTAL']);
    expect(ecart.bloquants[0].message).toContain('reste 1');
    expect(controlerReservation(entree({ ...base, fonds: [{ montant: '6000' }, { montant: '4000' }] })).bloquants).toEqual([]);
    // Frais de 1 % : 10 100 désinvestis pour 10 000 investis ; c'est le brut que les fonds égalent.
    const avecFrais = { ...base, montantBrut: '10100', montantNet: '9999' };
    expect(controlerReservation(entree({ ...avecFrais, fonds: [{ montant: '10100' }] })).bloquants).toEqual([]);
    expect(codes(controlerReservation(entree({ ...avecFrais, fonds: [{ montant: '9999' }] })).bloquants)).toEqual(['FONDS_TOTAL']);
  });

  it('désinvestissement en pourcentage : l’encours du contrat est obligatoire', () => {
    const base = { typeOperation: 'ARBITRAGE' as const, modeArbitrage: 'PAR_FONDS' as const };
    expect(codes(controlerReservation(entree({ ...base, fonds: [{ montant: '10000', pourcentage: '0.25' }] })).bloquants)).toEqual(['ENCOURS_CONTRAT']);
    expect(controlerReservation(entree({ ...base, valeurContrat: '40000', fonds: [{ montant: '10000', pourcentage: '0.25' }] })).bloquants).toEqual([]);
  });

  it('arbitrage global : pourcentage et valeur requis, 100 % au plus ; alerte au-delà de 5 % d’écart d’estimation', () => {
    const base = { typeOperation: 'ARBITRAGE' as const, modeArbitrage: 'GLOBAL' as const };
    expect(codes(controlerReservation(entree(base)).bloquants)).toEqual(['ARBITRAGE_GLOBAL']);
    expect(codes(controlerReservation(entree({ ...base, pourcentageArbitrage: '1.2', valeurContrat: '50000' })).bloquants)).toEqual(['ARBITRAGE_GLOBAL']);
    expect(controlerReservation(entree({ ...base, pourcentageArbitrage: '0.2', valeurContrat: '50000' })).alertes).toEqual([]);
    const loin = controlerReservation(entree({ ...base, pourcentageArbitrage: '0.25', valeurContrat: '50000' }));
    expect(loin.bloquants).toEqual([]);
    expect(codes(loin.alertes)).toEqual(['ESTIMATION_ARBITRAGE']);
  });

  it('au-delà de l’enveloppe restante : liste d’attente ou dérogation', () => {
    expect(codes(controlerReservation(entree({}, { restante: '9999.99' })).derogeables)).toEqual(['DEPASSEMENT']);
    expect(controlerReservation(entree({}, { restante: '10000' })).derogeables).toEqual([]);
  });

  it('réservation globale : la part au-delà de son solde est prise sur l’enveloppe', () => {
    const r = controlerReservation(entree({}, { soldeGlobale: '7000', restante: '2000' }));
    expect(r.priseSurEnveloppe.toString()).toBe('3000');
    expect(codes(r.alertes)).toEqual(['DEPASSE_SOLDE_GLOBALE']);
    expect(codes(r.derogeables)).toEqual(['DEPASSEMENT']);
    expect(controlerReservation(entree({}, { soldeGlobale: '20000', restante: '0' })).derogeables).toEqual([]);
  });

  it('concentration : alerte non bloquante, en cumulant les autres réservations actives du client', () => {
    expect(controlerReservation(entree({}, { cumulClientAutres: '20000' })).alertes).toEqual([]);
    const r = controlerReservation(entree({}, { cumulClientAutres: '20001' }));
    expect(codes(r.alertes)).toEqual(['CONCENTRATION']);
    expect(r.bloquants).toEqual([]);
  });

  it('signale un encours absent, qui empêche le contrôle de concentration', () => {
    expect(codes(controlerReservation(entree({ encoursClient: null })).alertes)).toEqual(['ENCOURS_ABSENT']);
  });

  it('après la date limite interne : dérogation de l’administrateur seulement ; enveloppe non ouverte : bloquant', () => {
    expect(codes(controlerReservation(entree({}, { maintenant: new Date('2027-01-20T23:30:00Z') })).derogeables)).toEqual(['DATE_LIMITE']);
    expect(codes(controlerReservation(entree({}, {}, { statut: 'FERMEE' })).derogeables)).toEqual(['DATE_LIMITE']);
    expect(codes(controlerReservation(entree({}, {}, { statut: 'EN_PREPARATION' })).bloquants)).toEqual(['ENVELOPPE_FERMEE']);
  });
});
