import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configurerApplication } from './shared/configuration-application';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());
  app.disable('x-powered-by');
  // Derrière le serveur frontal d'IONOS : l'adresse du visiteur vient de l'en-tête transmis.
  if (process.env.CONFIANCE_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // Seules les adresses déclarées peuvent appeler le serveur depuis un navigateur.
  const origines = (process.env.ORIGINES_AUTORISEES ?? '')
    .split(',')
    .map((origine) => origine.trim())
    .filter(Boolean);
  app.enableCors({ origin: origines, methods: 'GET,POST,PUT,PATCH,DELETE', credentials: true });

  configurerApplication(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
