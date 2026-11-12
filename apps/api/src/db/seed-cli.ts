import { createDb } from './client.js';
import { seedAdmin, seedDemo } from './seed.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const { db, pool } = createDb(url);
try {
  if (process.env.ADMIN_EMAIL) {
    await seedAdmin(db, process.env.ADMIN_EMAIL);
    console.log(`Allowlisted ${process.env.ADMIN_EMAIL} as admin`);
  } else {
    console.warn('ADMIN_EMAIL not set; skipping admin allowlist entry');
  }
  await seedDemo(db);
  console.log('Demo data seeded');
} finally {
  await pool.end();
}
