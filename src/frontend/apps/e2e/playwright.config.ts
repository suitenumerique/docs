import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({
  path: ['./.env.local', './.env'],
  quiet: true,
  debug: !process.env.CI,
});

const PORT = process.env.PORT;
const baseURL = process.env.BASE_URL;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // Timeout per test
  timeout: 30 * 1000,
  testDir: './__tests__',
  outputDir: './test-results',

  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  maxFailures: process.env.CI ? 3 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 3 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: './report' }],
    ['list', { printSteps: true }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: `cd ../.. && yarn app:dev --port ${PORT}`,
          url: baseURL,
          timeout: 120 * 1000,
          reuseExistingServer: true,
        },
      }),
  globalSetup: require.resolve('./__tests__/app-impress/auth.setup'),
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-US',
        timezoneId: 'Europe/Paris',
        storageState: 'playwright/.auth/user-chromium.json',
        contextOptions: {
          permissions: ['clipboard-read', 'clipboard-write'],
        },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        locale: 'en-US',
        timezoneId: 'Europe/Paris',
        storageState: 'playwright/.auth/user-webkit.json',
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        locale: 'en-US',
        timezoneId: 'Europe/Paris',
        storageState: 'playwright/.auth/user-firefox.json',
        launchOptions: {
          firefoxUserPrefs: {
            'dom.events.asyncClipboard.readText': true,
            'dom.events.testing.asyncClipboard': true,
          },
        },
      },
    },
  ],
});
