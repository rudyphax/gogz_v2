import pg from 'pg';
import { runMigrations } from '../apps/api/src/db/migrate.ts';

/** Creates the e2e database if needed and applies migrations. */
const url = new URL(process.env.DATABASE_URL ?? 'postgres://localhost:5432/gogz_e2e');
const admin = new URL(url);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const name = url.pathname.slice(1);
const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
await client.end();
await runMigrations(url.toString());
