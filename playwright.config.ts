import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const e2eDbPath = path.resolve(__dirname, 'data', 'e2e_test.sqlite');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3101',
    channel: 'msedge',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      'node -e "for(const s of [\'\',\'-wal\',\'-shm\'])try{require(\'fs\').rmSync(\'data/e2e_test.sqlite\'+s,{force:true})}catch{}" && npx tsx src/server/index.ts',
    url: 'http://localhost:3101/api/v1/health',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: '3101',
      GCCK_DB_PATH: e2eDbPath,
    },
  },
});
