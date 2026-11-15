import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Réglages communs au serveur et aux tests : mêmes règles de validation dans les deux cas.
 * Un champ inconnu dans une demande est refusé.
 */
export function configurerApplication(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
}
