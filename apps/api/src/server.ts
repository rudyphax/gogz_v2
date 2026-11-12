import { buildAppFromEnv } from './bootstrap.js';

const port = Number(process.env.PORT ?? 3011);
buildAppFromEnv().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
