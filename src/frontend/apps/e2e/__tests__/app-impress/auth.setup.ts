import { FullConfig, FullProject, chromium, expect } from '@playwright/test';

import { keyCloakSignIn } from './common';

const saveStorageState = async (
  browserConfig: FullProject<unknown, unknown>,
) => {
  const browserName = browserConfig?.name || 'chromium';

  const { storageState, ...useConfig } = browserConfig?.use;
  const browser = await chromium.launch();
  const context = await browser.newContext(useConfig);
  const page = await context.newPage();

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.content();
  await expect(page.getByText('Docs').first()).toBeVisible();

  await keyCloakSignIn(page, browserName);

  await expect(
    page.locator('header').first().getByRole('button', {
      name: 'Logout',
    }),
  ).toBeVisible();

  await page.context().storageState({
    path: storageState as string,
  });

  await browser.close();
};

async function globalSetup(config: FullConfig) {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const chromeConfig = config.projects.find((p) => p.name === 'chromium')!;
  const firefoxConfig = config.projects.find((p) => p.name === 'firefox')!;
  const webkitConfig = config.projects.find((p) => p.name === 'webkit')!;
  /* eslint-enable @typescript-eslint/no-non-null-assertion */

  await saveStorageState(chromeConfig);
  await saveStorageState(webkitConfig);
  await saveStorageState(firefoxConfig);
}

export default globalSetup;
