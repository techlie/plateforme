/**
 * Tests de bout en bout de la connexion et des droits, sur une vraie base PostgreSQL de test.
 * Toutes les personnes et adresses sont inventées.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurerApplication } from '../src/shared/configuration-application';
import { Courriel, TransportCourriel } from '../src/shared/courriel/courriel.service';
import { PrismaService } from '../src/shared/prisma/prisma.service';

class BoiteDeTest extends TransportCourriel {
  recus: Courriel[] = [];
  async envoyer(courriel: Courriel): Promise<void> {
    this.recus.push(courriel);
  }
  dernierPour(adresse: string): Courriel {
    const trouve = [...this.recus].reverse().find((c) => c.a === adresse);
    if (!trouve) throw new Error(`Aucun courriel pour ${adresse}`);
    return trouve;
  }
  codePour(adresse: string): string {
    return /(\d{6})/.exec(this.dernierPour(adresse).objet)![1];
  }
  jetonPour(adresse: string): string {
    return /jeton=([A-Za-z0-9_-]+)/.exec(this.dernierPour(adresse).texte)![1];
  }
}

const MOT_DE_PASSE = 'une phrase de passe assez longue';
const SA = 'claire.essai@exemple.fr';
const ADMIN = 'paul.essai@exemple.fr';
const MANDATAIRE = 'lea.essai@exemple.fr';

describe('Connexion et droits (bout en bout)', () => {
  let app: INestApplication;
  let boite: BoiteDeTest;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());

  /** Connexion complète en deux étapes ; renvoie le cookie de session. */
  async function seConnecter(email: string, motDePasse = MOT_DE_PASSE): Promise<string> {
    const etape1 = await http().post('/api/auth/connexion').send({ email, motDePasse }).expect(200);
    const etape2 = await http()
      .post('/api/auth/code')
      .send({ demande: etape1.body.demande, code: boite.codePour(email) })
      .expect(200);
    const cookie = ([] as string[]).concat(etape2.headers['set-cookie'] ?? []).find((c) => c.startsWith('sr_session='));
    if (!cookie) throw new Error('Pas de cookie de session');
    return cookie.split(';')[0];
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
    process.env.CLE_SECRETE = 'cle-de-test-uniquement-pour-les-tests-0123456789';
    process.env.URL_APPLICATION = 'http://localhost:4200';
    process.env.NODE_ENV = 'test';
    boite = new BoiteDeTest();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TransportCourriel)
      .useValue(boite)
      .compile();
    app = moduleRef.createNestApplication();
    configurerApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    const sr = await prisma.entite.create({ data: { nom: 'SR CONSEIL' } });
    const empreinte = await bcrypt.hash(MOT_DE_PASSE, 4);
    await prisma.user.create({
      data: { email: SA, nom: 'Essai', prenom: 'Claire', profil: 'SUPER_ADMINISTRATEUR', motDePasse: empreinte, entiteId: sr.id },
    });
    await prisma.user.create({
      data: { email: ADMIN, nom: 'Essai', prenom: 'Paul', profil: 'ADMINISTRATEUR', motDePasse: empreinte, entiteId: sr.id },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse un champ inconnu et un mauvais mot de passe, avec le même message pour une adresse inconnue', async () => {
    await http().post('/api/auth/connexion').send({ email: SA, motDePasse: 'x', role: 'admin' }).expect(400);
    const faux = await http().post('/api/auth/connexion').send({ email: SA, motDePasse: 'mauvais' }).expect(401);
    const inconnu = await http().post('/api/auth/connexion').send({ email: 'personne@exemple.fr', motDePasse: 'mauvais' }).expect(401);
    expect(faux.body.message).toBe(inconnu.body.message);
  });

  it('demande le code reçu par courriel avant d’ouvrir la session', async () => {
    const etape1 = await http().post('/api/auth/connexion').send({ email: SA, motDePasse: MOT_DE_PASSE }).expect(200);
    expect(etape1.body).toMatchObject({ etape: 'CODE', adresseMasquee: 'c…i@exemple.fr' });
    expect(etape1.headers['set-cookie']).toBeUndefined();

    const bonCode = boite.codePour(SA);
    const mauvais = bonCode === '000000' ? '111111' : '000000';
    await http().post('/api/auth/code').send({ demande: etape1.body.demande, code: mauvais }).expect(401);

    const etape2 = await http().post('/api/auth/code').send({ demande: etape1.body.demande, code: bonCode }).expect(200);
    expect(etape2.body).toMatchObject({ email: SA, profil: 'SUPER_ADMINISTRATEUR' });
    const cookie = ([] as string[]).concat(etape2.headers['set-cookie']).join(';');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);

    // Le code ne sert qu'une fois.
    await http().post('/api/auth/code').send({ demande: etape1.body.demande, code: bonCode }).expect(401);
  });

  it('ferme toutes les routes sans session', async () => {
    await http().get('/api/auth/moi').expect(401);
    await http().get('/api/simulateur/contrats').expect(401);
    await http().get('/api/utilisateurs').expect(401);
    await http().get('/api/journal').expect(401);
  });

  it('annule la demande après cinq codes faux', async () => {
    const etape1 = await http().post('/api/auth/connexion').send({ email: ADMIN, motDePasse: MOT_DE_PASSE }).expect(200);
    const bonCode = boite.codePour(ADMIN);
    const mauvais = bonCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await http().post('/api/auth/code').send({ demande: etape1.body.demande, code: mauvais }).expect(401);
    }
    const refus = await http().post('/api/auth/code').send({ demande: etape1.body.demande, code: bonCode }).expect(401);
    expect(refus.body.code).toBe('CODE_PERIME');
  });

  it('crée un mandataire, qui active son compte par le lien reçu', async () => {
    const sa = await seConnecter(SA);
    const sr = await prisma.entite.findFirstOrThrow({ where: { nom: 'SR CONSEIL' } });
    const cree = await http()
      .post('/api/utilisateurs')
      .set('Cookie', sa)
      .send({ email: MANDATAIRE.toUpperCase(), nom: 'Essai', prenom: 'Léa', profil: 'MANDATAIRE', entiteId: sr.id, modules: [] })
      .expect(201);
    expect(cree.body).toMatchObject({ email: MANDATAIRE, compteActive: false, modules: [] });
    expect(cree.body.motDePasse).toBeUndefined();

    // Une adresse n'appartient qu'à une personne.
    await http()
      .post('/api/utilisateurs')
      .set('Cookie', sa)
      .send({ email: MANDATAIRE, nom: 'Autre', prenom: 'Personne', profil: 'MANDATAIRE', modules: [] })
      .expect(409);

    const jeton = boite.jetonPour(MANDATAIRE);
    const lien = await http().post('/api/auth/lien').send({ jeton }).expect(200);
    expect(lien.body).toEqual({ motif: 'ACTIVATION', prenom: 'Léa' });
    await http().post('/api/auth/mot-de-passe').send({ jeton, motDePasse: 'court' }).expect(400);
    await http().post('/api/auth/mot-de-passe').send({ jeton, motDePasse: MOT_DE_PASSE }).expect(204);
    await http().post('/api/auth/mot-de-passe').send({ jeton, motDePasse: MOT_DE_PASSE }).expect(401);
  });

  it('limite le mandataire à son profil et à ses modules, vérifiés à chaque demande', async () => {
    const mandataire = await seConnecter(MANDATAIRE);
    const moi = await http().get('/api/auth/moi').set('Cookie', mandataire).expect(200);
    expect(moi.body).toMatchObject({ profil: 'MANDATAIRE', modules: [], entite: { nom: 'SR CONSEIL' } });

    const refus = await http().get('/api/simulateur/contrats').set('Cookie', mandataire).expect(403);
    expect(refus.body.code).toBe('MODULE');
    await http().get('/api/utilisateurs').set('Cookie', mandataire).expect(403);
    await http().get('/api/journal').set('Cookie', mandataire).expect(403);

    const sa = await seConnecter(SA);
    const fiche = await prisma.user.findUniqueOrThrow({ where: { email: MANDATAIRE } });
    await http().patch(`/api/utilisateurs/${fiche.id}`).set('Cookie', sa).send({ modules: ['SIMULATEUR'] }).expect(200);
    await http().get('/api/simulateur/contrats').set('Cookie', mandataire).expect(200);

    // Désactivé : l'accès est coupé aussitôt, sans attendre la fin de la session.
    await http().patch(`/api/utilisateurs/${fiche.id}`).set('Cookie', sa).send({ actif: false }).expect(200);
    await http().get('/api/auth/moi').set('Cookie', mandataire).expect(401);
    await http().post('/api/auth/connexion').send({ email: MANDATAIRE, motDePasse: MOT_DE_PASSE }).expect(401);
    await http().patch(`/api/utilisateurs/${fiche.id}`).set('Cookie', sa).send({ actif: true }).expect(200);
  });

  it('réserve les super administrateurs aux super administrateurs et protège contre soi-même', async () => {
    const admin = await seConnecter(ADMIN);
    const refus = await http()
      .post('/api/utilisateurs')
      .set('Cookie', admin)
      .send({ email: 'nouveau.sa@exemple.fr', nom: 'Essai', prenom: 'Nouveau', profil: 'SUPER_ADMINISTRATEUR', modules: [] })
      .expect(403);
    expect(refus.body.code).toBe('SUPER_ADMIN');

    const ficheSa = await prisma.user.findUniqueOrThrow({ where: { email: SA } });
    await http().patch(`/api/utilisateurs/${ficheSa.id}`).set('Cookie', admin).send({ actif: false }).expect(403);

    const sa = await seConnecter(SA);
    const soi = await http().patch(`/api/utilisateurs/${ficheSa.id}`).set('Cookie', sa).send({ actif: false }).expect(403);
    expect(soi.body.code).toBe('SOI_MEME');
  });

  it('bloque le compte quinze minutes après cinq mots de passe faux', async () => {
    for (let i = 0; i < 5; i++) {
      await http().post('/api/auth/connexion').send({ email: MANDATAIRE, motDePasse: 'mauvais mot de passe' }).expect(401);
    }
    const bloque = await http().post('/api/auth/connexion').send({ email: MANDATAIRE, motDePasse: MOT_DE_PASSE }).expect(429);
    expect(bloque.body.code).toBe('BLOQUE');
    await prisma.user.update({ where: { email: MANDATAIRE }, data: { bloqueJusqua: null } });
  });

  it('répond pareil au mot de passe oublié, que l’adresse existe ou non', async () => {
    const avant = boite.recus.length;
    const inconnu = await http().post('/api/auth/mot-de-passe-oublie').send({ email: 'personne@exemple.fr' }).expect(200);
    expect(boite.recus.length).toBe(avant);
    const connu = await http().post('/api/auth/mot-de-passe-oublie').send({ email: MANDATAIRE }).expect(200);
    expect(connu.body).toEqual(inconnu.body);
    expect(boite.dernierPour(MANDATAIRE).texte).toContain('/reinitialisation?jeton=');
  });

  it('ferme la session à la déconnexion et trace tout au journal', async () => {
    const sa = await seConnecter(SA);
    await http().post('/api/auth/deconnexion').set('Cookie', sa).expect(204);
    await http().get('/api/auth/moi').set('Cookie', sa).expect(401);

    const sa2 = await seConnecter(SA);
    const journal = await http().get('/api/journal?parPage=200').set('Cookie', sa2).expect(200);
    const actions = new Set(journal.body.lignes.map((l: { action: string }) => l.action));
    for (const action of ['CONNEXION', 'CODE_ENVOYE', 'CODE_REFUSE', 'CONNEXION_REFUSEE', 'COMPTE_BLOQUE', 'UTILISATEUR_CREE', 'UTILISATEUR_DESACTIVE', 'COMPTE_ACTIVE', 'DECONNEXION']) {
      expect(actions).toContain(action);
    }
    // Aucun code ni mot de passe n'apparaît dans le journal.
    const brut = JSON.stringify(await prisma.log.findMany());
    expect(brut).not.toContain(MOT_DE_PASSE);
  });
});
