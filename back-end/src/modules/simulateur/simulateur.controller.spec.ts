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
    for (const champ of ['coefficient', 'surcommission', 'tauxMandataireReference', 'deductionFrais', 'partCabinet', 'ajout']) {
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
      .send({ cleContrat: 'ABEILLE|RETRAITE|RETRAITE PLURIELLE', montant: 6000, frais: 0.03, variante: 'AVANCE_5_ANS' })
      .expect(200);
    const champs = Object.keys(reponse.body);
    for (const interdit of ['montantCompagnie', 'montantCabinet', 'tauxCompagnie', 'tauxCabinet', 'tauxMandataire']) {
      expect(champs).not.toContain(interdit);
    }
    expect(reponse.body.lignes.map((l: { code: string }) => l.code)).toEqual(['BASE', 'SURCOMMISSION']);
  });

  it('refuse que l’écran impose un taux de réversion', async () => {
    await request(app.getHttpServer())
      .post('/api/simulateur/calcul')
      .send({ cleContrat: 'ALPTIS|PREVOYANCE|PREVOYANCE_PRO_PLUS', montant: 1200, option: '30%/10% PRE', tauxReversion: 1 })
      .expect(400);
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
