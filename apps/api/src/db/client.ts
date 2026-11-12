import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;

/**
 * Standard Postgres driver. Works the same against local Postgres and Neon
 * (use Neon's pooled connection string in production).
 */
export function createDb(connectionString: string): { db: Db; pool: pg.Pool } {
  const needsSsl = /sslmode=require|neon\.tech/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  });
  return { db: drizzle(pool, { schema }), pool };
}
