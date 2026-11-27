import { defineConfig } from '@playwright/test';
import { resolveBasePath } from './scripts/lib/base-path.mjs';

/**
 * E2E runs against the production build served by `vite preview` — the same
 * artifact and server the systemd service uses (QA-01).
 *
 * QA-02: Playwright's managed Chromium is used by default (`npx playwright install
 * chromium`). PLAYWRIGHT_CHROMIUM_PATH optionally points to a system Chromium
 * (e.g. /usr/bin/chromium) on machines without managed browsers.
 * QA-03: the base path comes from VITE_BASE_PATH through scripts/lib/base-path.mjs.
 */
const BASE_PATH = resolveBasePath();
const PORT = Number(process.env.ATLAS_E2E_PORT ?? 4174);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH?.trim() || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
