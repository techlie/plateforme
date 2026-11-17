import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

/**
 * Remet à neuf la base de test avant les tests de bout en bout : schéma vidé, puis
 * migrations rejouées dans l'ordre. Refuse de tourner sans base de test déclarée,
 * pour ne jamais toucher une autre base.
 */
export default async function preparerBase(): Promise<void> {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || !/test/i.test(url)) {
    throw new Error('DATABASE_URL_TEST doit désigner une base dont le nom contient « test ».');
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    const dossier = join(__dirname, '..', 'prisma', 'migrations');
    const migrations = readdirSync(dossier, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const migration of migrations) {
      await client.query(readFileSync(join(dossier, migration, 'migration.sql'), 'utf8'));
    }
  } finally {
    await client.end();
  }
}
