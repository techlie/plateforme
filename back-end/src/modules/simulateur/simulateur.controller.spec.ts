import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurerApplication } from '../../shared/configuration-application';
import { SimulateurModule } from './simulateur.module';

describe('API du simulateur', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [SimulateurModule] }).compile();
    app = module.createNestApplication();
    configurerApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('liste les 151 contrats du barème en vigueur', async () => {
    const reponse = await request(app.getHttpServer()).get('/api/simulateur/contrats').expect(200);
    expect(reponse.body.bareme.code).toBe('COMMISSIONS-2026');
    expect(reponse.body.contrats).toHaveLength(151);
  });

  it('ne laisse sortir aucun taux interne du barème dans la liste des contrats', async () => {
    const reponse = await request(app.getHttpServer()).get('/api/simulateur/contrats').expect(200);
    const texte = JSON.stringify(reponse.body);
    const internes = [
      'coefficient',
      'surcommission',
      'tauxMandataireReference',
      'deductionFrais',
      'partCabinet',
      'ajout',
      'ponderationAge',
      'partFixeIncluse',
      'tauxUcAuDessus',
      'source',
    ];
    for (const champ of internes) {
      expect(texte).not.toContain(`"${champ}"`);
    }
  });

  it('estime une commission de prévoyance', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ cleContrat: 'ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', montant: 1200, option: '30%/10% PRE' })
      .expect(200);
    expect(reponse.body.montant).toBe(186.35);
    expect(reponse.body.baseCalcul).toBe(1044);
  });

  it('ne montre au mandataire ni la commission compagnie ni la part du cabinet', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({
        cleContrat: 'ABEILLE|RETRAITE|RETRAITE PLURIELLE',
        montant: 6000,
        frais: 0.03,
        variante: 'AVANCE_5_ANS',
        age: 45,
        partUc: 1,
      })
      .expect(200);
    const champs = Object.keys(reponse.body);
    for (const interdit of ['montantCompagnie', 'montantCabinet', 'tauxCompagnie', 'tauxCabinet', 'tauxMandataire']) {
      expect(champs).not.toContain(interdit);
    }
    expect(reponse.body.lignes.map((l: { code: string }) => l.code)).toEqual(['BASE', 'SURCOMMISSION']);
  });

  it('indique à l’écran les contrats qui demandent l’âge, la part en unités de compte et le plafond', async () => {
    const reponse = await request(app.getHttpServer()).get('/api/simulateur/contrats').expect(200);
    const trouver = (cle: string) => reponse.body.contrats.find((c: { cle: string }) => c.cle === cle);
    const abeille = trouver('ABEILLE|RETRAITE|RETRAITE PLURIELLE');
    expect([abeille.demandeAge, abeille.demandePartUc, abeille.plafondAnnuel]).toEqual([true, true, 24000]);
    const swissLife = trouver('SWISSLIFE|RETRAITE|PER INDIVIDUEL');
    expect([swissLife.demandeAge, swissLife.demandePartUc]).toEqual([false, true]);
    const generali = trouver('GENERALI|RETRAITE|GENERALI RETRAITE PRO');
    expect([generali.demandeAge, generali.demandePartUc]).toEqual([true, false]);
    const alptis = trouver('ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS');
    expect([alptis.demandeAge, alptis.demandePartUc]).toEqual([false, false]);
  });

  it('applique le plafond Abeille et prévient le mandataire', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({
        cleContrat: 'ABEILLE|RETRAITE|RETRAITE PLURIELLE',
        montant: 36000,
        frais: 0.03,
        variante: 'AVANCE_5_ANS',
        remuneration: 'ENCOURS_MAX',
        age: 45,
        partUc: 1,
      })
      .expect(200);
    expect(reponse.body.montant).toBe(7880.78); // 70 % de 11 258,25 €
    expect(reponse.body.avertissements.map((a: { code: string }) => a.code)).toEqual(['PLAFOND_SURCOMMISSION']);
  });

  it('demande l’âge quand le contrat en dépend', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ cleContrat: 'GENERALI|RETRAITE|GENERALI RETRAITE PRO', montant: 6000, option: '2,95 %' })
      .expect(400);
    expect(reponse.body.code).toBe('AGE_MANQUANT');
  });

  it('chiffre le co-courtage : part du cabinet d’expertise comptable et reste du mandataire', async () => {
    const catalogue = await request(app.getHttpServer()).get('/api/simulateur/contrats').expect(200);
    expect(catalogue.body.coCourtage).toEqual({ tauxParDefaut: 0.3, tauxMax: 0.5 });
    const reponse = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ cleContrat: 'ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', montant: 1200, option: '30%/10% PRE', tauxCoCourtage: 0.3 })
      .expect(200);
    expect(reponse.body.montant).toBe(120.58);
    expect(reponse.body.coCourtage).toEqual({ taux: 0.3, montant: 93.96 });
  });

  it('n’annonce pas de co-courtage quand il n’y en a pas', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ cleContrat: 'ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', montant: 1200, option: '30%/10% PRE' })
      .expect(200);
    expect(reponse.body.coCourtage).toBeUndefined();
  });

  it('donne la règle de reprise du contrat et son effet sur l’affaire', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ cleContrat: 'GENERALI|RETRAITE|GENERALI RETRAITE PRO', montant: 6000, option: '2,95 %', age: 40 })
      .expect(200);
    expect(reponse.body.reprise.regle).toContain('6 ans');
    expect(reponse.body.reprise.calcul).toContain('72');
    expect(reponse.body.reprise.exemples[1]).toMatchObject({ mois: 18, montant: 1633.5 });
    expect(JSON.stringify(reponse.body.reprise)).not.toContain('"source"');
  });

  it('accepte un taux de reversement proposé et refuse les autres', async () => {
    const base = { cleContrat: 'ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', montant: 1200, option: '30%/10% PRE' };
    const catalogue = await request(app.getHttpServer()).get('/api/simulateur/contrats').expect(200);
    expect(catalogue.body.tauxReversion).toEqual({ proposes: [0.7, 0.8, 0.9], parDefaut: 0.7 });
    const a80 = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ ...base, tauxReversion: 0.8 })
      .expect(200);
    expect(a80.body.montant).toBe(212.98);
    expect(a80.body.tauxReversion).toBe(0.8);
    const refus = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ ...base, tauxReversion: 1 })
      .expect(400);
    expect(refus.body.code).toBe('REVERSION_NON_PROPOSEE');
  });

  it('explique le refus quand l’option n’existe pas', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ cleContrat: 'ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', montant: 1200, option: 'inconnue' })
      .expect(400);
    expect(reponse.body.code).toBe('OPTION_INCONNUE');
  });

  it('refuse un montant qui n’est pas un nombre', async () => {
    await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ cleContrat: 'ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', montant: 'beaucoup', option: '30%/10% PRE' })
      .expect(400);
  });
});
