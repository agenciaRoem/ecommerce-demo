import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta en un navegador real, contra la pila levantada (tienda en :3000, API en :4000)
 * y sembrada con el personal de ejemplo. Ver "Pruebas" en el README para levantarla.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'es-AR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
