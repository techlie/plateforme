import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurerApplication } from '../src/shared/configuration-application';
import { Courriel, TransportCourriel } from '../src/shared/courriel/courriel.service';

/** Boîte aux lettres des tests : les courriels y sont gardés au lieu d'être envoyés. */
export class BoiteDeTest extends TransportCourriel {
  recus: Courriel[] = [];
  async envoyer(courriel: Courriel): Promise<void> {
    this.recus.push(courriel);
  }
  pour(adresse: string): Courriel[] {
    return this.recus.filter((c) => c.a === adresse);
  }
  dernierPour(adresse: string): Courriel {
    const trouve = [...this.recus].reverse().find((c) => c.a === adresse);
    if (!trouve) throw new Error(`Aucun courriel pour ${adresse}`);
    return trouve;
  }
  codePour(adresse: string): string {
    return /(\d{6})/.exec(this.dernierPour(adresse).objet)![1];
  }
  vider(): void {
    this.recus = [];
  }
}

/** Démarre l'application complète sur la base de test, courriels interceptés. */
export async function demarrer(): Promise<{ app: INestApplication; boite: BoiteDeTest }> {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  process.env.CLE_SECRETE = 'cle-de-test-uniquement-pour-les-tests-0123456789';
  process.env.URL_APPLICATION = 'http://localhost:4200';
  process.env.NODE_ENV = 'test';
  process.env.DOSSIER_DOCUMENTS = process.env.DOSSIER_DOCUMENTS_TEST ?? '/tmp/plateforme-documents-test';
  const boite = new BoiteDeTest();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TransportCourriel)
    .useValue(boite)
    .compile();
  const app = moduleRef.createNestApplication();
  configurerApplication(app);
  await app.init();
  return { app, boite };
}

/** Connexion complète en deux étapes ; renvoie le cookie de session. */
export async function seConnecter(app: INestApplication, boite: BoiteDeTest, email: string, motDePasse: string): Promise<string> {
  const etape1 = await request(app.getHttpServer()).post('/api/auth/connexion').send({ email, motDePasse }).expect(200);
  const etape2 = await request(app.getHttpServer()).post('/api/auth/code').send({ demande: etape1.body.demande, code: boite.codePour(email) }).expect(200);
  const cookie = ([] as string[]).concat(etape2.headers['set-cookie'] ?? []).find((c) => c.startsWith('sr_session='));
  if (!cookie) throw new Error('Pas de cookie de session');
  return cookie.split(';')[0];
}
