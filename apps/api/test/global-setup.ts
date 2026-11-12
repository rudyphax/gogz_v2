import pg from 'pg';
import { runMigrations } from '../src/db/migrate.js';

/** Creates the test database if needed and applies migrations once per run. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/gogz_test');
  const dbName = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();
  await runMigrations(url.toString());
}
