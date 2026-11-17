/**
 * Initialisation d'une base neuve, à lancer une fois après la première migration :
 *   node dist/scripts/initialiser.js --email adresse@exemple.fr --prenom Prénom --nom Nom
 * Crée les entités du groupe qui manquent, puis le premier super administrateur, qui
 * reçoit par courriel le lien pour choisir son mot de passe. Aucun mot de passe ne
 * passe par ce script ni par le dépôt.
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../modules/auth/auth.service';
import { JournalService } from '../shared/journal/journal.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { normaliserAdresse } from '../shared/securite/securite';

/** Entités connues au 17 novembre 2026. La liste reste ouverte dans l'écran d'administration. */
export const ENTITES_INITIALES = [
  'SR CONSEIL',
  'Label Assurances',
  'Label Santé',
  'RJ Assurances',
  'Nembrini Colombani',
  'A2C Courtage',
  'A3C (Midi Courtage)',
  'TC2K',
];

function argument(nom: string): string | undefined {
  const position = process.argv.indexOf(`--${nom}`);
  return position >= 0 ? process.argv[position + 1] : undefined;
}

async function initialiser(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const journal = app.get(JournalService);

  for (const nom of ENTITES_INITIALES) {
    const existe = await prisma.entite.findFirst({ where: { nom: { equals: nom, mode: 'insensitive' } } });
    if (!existe) {
      await prisma.entite.create({ data: { nom } });
      console.log(`Entité créée : ${nom}`);
    }
  }

  const emailSaisi = argument('email');
  if (emailSaisi) {
    const email = normaliserAdresse(emailSaisi);
    const prenom = argument('prenom') ?? '';
    const nom = argument('nom') ?? '';
    if (!prenom || !nom) {
      throw new Error('Indiquez --prenom et --nom avec --email.');
    }
    const existant = await prisma.user.findUnique({ where: { email } });
    if (existant) {
      console.log(`Un compte existe déjà pour ${email} : rien n'est créé.`);
    } else {
      const sr = await prisma.entite.findFirst({ where: { nom: 'SR CONSEIL' } });
      const cree = await prisma.user.create({
        data: { email, prenom, nom, profil: 'SUPER_ADMINISTRATEUR', entiteId: sr?.id ?? null },
      });
      await journal.ecrire({
        action: 'UTILISATEUR_CREE',
        message: `Premier super administrateur créé par le script d'initialisation : ${prenom} ${nom}.`,
        succes: true,
        cible: cree.id,
        auteur: "Script d'initialisation",
      });
      await app.get(AuthService).demanderReinitialisation(email, { adresseIp: null, navigateur: null });
      console.log(`Super administrateur créé pour ${email} ; le lien d'activation lui est envoyé.`);
    }
  }
  await app.close();
}

initialiser().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
