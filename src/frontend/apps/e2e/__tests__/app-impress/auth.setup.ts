import { test as setup } from '@playwright/test';

import { keyCloakSignIn } from './common';

setup('authenticate-chromium', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('proconnect-button').first().click();
  await keyCloakSignIn(page, 'chromium');
  await page
    .context()
    .storageState({ path: `playwright/.auth/user-chromium.json` });
});

setup('authenticate-webkit', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('proconnect-button').first().click();
  await keyCloakSignIn(page, 'webkit');
  await page
    .context()
    .storageState({ path: `playwright/.auth/user-webkit.json` });
});

setup('authenticate-firefox', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('proconnect-button').first().click();
  await keyCloakSignIn(page, 'firefox');
  await page
    .context()
    .storageState({ path: `playwright/.auth/user-firefox.json` });
});
