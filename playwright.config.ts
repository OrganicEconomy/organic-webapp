import { defineConfig, devices } from '@playwright/test';

const WEBAPP_PORT = 4300;
const SERVER_PORT = 6870;
const SERVER_DIRECTORY = '../organic-webserver/organic-webserver';

export const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEBAPP_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      command: 'node --env-file=../.env.test --import tsx server.ts',
      cwd: SERVER_DIRECTORY,
      url: `${SERVER_URL}/api/v1/info`,
      env: {
        NODE_ENV: 'test',
        NODE_LOCAL_PORT: String(SERVER_PORT),
        CORS_EXTRA_ORIGINS: `http://localhost:${WEBAPP_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx ng serve --port ${WEBAPP_PORT}`,
      url: `http://localhost:${WEBAPP_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
