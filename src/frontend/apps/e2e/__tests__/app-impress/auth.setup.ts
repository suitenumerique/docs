import { FullConfig, FullProject, chromium, expect } from '@playwright/test';

import { SignIn } from './utils-signin';

const saveStorageState = async (
  browserConfig: FullProject<unknown, unknown>,
) => {
  if (!browserConfig) {
    throw new Error('No browser config found');
  }

  const browserName = browserConfig.name || 'chromium';

  const { storageState, ...useConfig } = browserConfig.use;
  const browser = await chromium.launch();
  const context = await browser.newContext(useConfig);
  const page = await context.newPage();

  try {
    // eslint-disable-next-line playwright/no-networkidle
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.content();
    await expect(page.getByText('Docs').first()).toBeVisible();

    await SignIn(page, browserName);

    /**
     * If the grid is displayed, it means the user is logged in and the storage state can be saved.
     */
    await expect(
      page.getByRole('heading', { name: 'All docs', level: 2 }),
    ).toBeVisible({ timeout: 10000 });

    await page.context().storageState({
      path: storageState as string,
    });
  } catch (error) {
    console.log(error);

    await page.screenshot({
      path: `./screenshots/${browserName}-${Date.now()}.png`,
    });
    // Get console logs
    const consoleLogs = await page.evaluate(() =>
      console.log(window.console.log),
    );
    console.log(consoleLogs);
  } finally {
    await browser.close();
  }
};

async function globalSetup(config: FullConfig) {
  const chromeConfig = config.projects.find((p) => p.name === 'chromium')!;
  const firefoxConfig = config.projects.find((p) => p.name === 'firefox')!;
  const webkitConfig = config.projects.find((p) => p.name === 'webkit')!;

  await saveStorageState(chromeConfig);
  await saveStorageState(webkitConfig);
  await saveStorageState(firefoxConfig);
}

export default globalSetup;
