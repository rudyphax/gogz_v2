import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@gogz/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globalSetup: ['./test/global-setup.ts'],
    // Tests share one database, so run files one at a time.
    fileParallelism: false,
    env: {
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/gogz_test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // schema.ts is declarations only; entry points are exercised by e2e.
      exclude: [
        'src/server.ts',
        'src/bootstrap.ts',
        'src/db/seed-cli.ts',
        'src/db/migrate.ts',
        'src/db/schema.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
