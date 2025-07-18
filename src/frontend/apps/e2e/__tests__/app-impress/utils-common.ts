import { Page, expect } from '@playwright/test';

export const BROWSERS = ['chromium', 'webkit', 'firefox'];

export const CONFIG = {
  AI_FEATURE_ENABLED: true,
  CRISP_WEBSITE_ID: null,
  COLLABORATION_WS_URL: 'ws://localhost:4444/collaboration/ws/',
  COLLABORATION_WS_NOT_CONNECTED_READY_ONLY: true,
  ENVIRONMENT: 'development',
  FRONTEND_CSS_URL: null,
  FRONTEND_HOMEPAGE_FEATURE_ENABLED: true,
  FRONTEND_THEME: null,
  MEDIA_BASE_URL: 'http://localhost:8083',
  LANGUAGES: [
    ['en-us', 'English'],
    ['fr-fr', 'Français'],
    ['de-de', 'Deutsch'],
    ['nl-nl', 'Nederlands'],
    ['es-es', 'Español'],
  ],
  LANGUAGE_CODE: 'en-us',
  POSTHOG_KEY: {},
  SENTRY_DSN: null,
  theme_customization: {},
} as const;

export const overrideConfig = async (
  page: Page,
  newConfig: { [K in keyof typeof CONFIG]?: unknown },
) =>
  await page.route('**/api/v1.0/config/', async (route) => {
    const request = route.request();
    if (request.method().includes('GET')) {
      await route.fulfill({
        json: {
          ...CONFIG,
          ...newConfig,
        },
      });
    } else {
      await route.continue();
    }
  });

export const keyCloakSignIn = async (
  page: Page,
  browserName: string,
  fromHome: boolean = true,
) => {
  if (fromHome) {
    await page.getByRole('button', { name: 'Start Writing' }).first().click();
  }

  const login = `user-e2e-${browserName}`;
  const password = `password-e2e-${browserName}`;

  await expect(
    page.locator('.login-pf-page-header').getByText('impress'),
  ).toBeVisible();

  if (await page.getByLabel('Restart login').isVisible()) {
    await page.getByLabel('Restart login').click();
  }

  await page.getByRole('textbox', { name: 'username' }).fill(login);
  await page.getByRole('textbox', { name: 'password' }).fill(password);
  await page.click('input[type="submit"]', { force: true });
};

export const randomName = (name: string, browserName: string, length: number) =>
  Array.from({ length }, (_el, index) => {
    return `${browserName}-${Math.floor(Math.random() * 10000)}-${index}-${name}`;
  });

export const createDoc = async (
  page: Page,
  docName: string,
  browserName: string,
  length: number = 1,
  isChild: boolean = false,
) => {
  const randomDocs = randomName(docName, browserName, length);

  for (let i = 0; i < randomDocs.length; i++) {
    if (!isChild) {
      const header = page.locator('header').first();
      await header.locator('h2').getByText('Docs').click();
    }

    await page
      .getByRole('button', {
        name: 'New doc',
      })
      .click();

    await page.waitForURL('**/docs/**', {
      timeout: 10000,
      waitUntil: 'networkidle',
    });

    const input = page.getByLabel('doc title input');
    await expect(input).toBeVisible();
    await expect(input).toHaveText('');
    await input.click();

    await input.fill(randomDocs[i]);
    await input.blur();
  }

  return randomDocs;
};

export const verifyDocName = async (page: Page, docName: string) => {
  await expect(
    page.getByLabel('It is the card information about the document.'),
  ).toBeVisible({
    timeout: 10000,
  });

  try {
    await expect(
      page.getByRole('textbox', { name: 'doc title input' }),
    ).toHaveText(docName);
  } catch {
    await expect(page.getByRole('heading', { name: docName })).toBeVisible();
  }
};

export const getGridRow = async (page: Page, title: string) => {
  const docsGrid = page.getByRole('grid');
  await expect(docsGrid).toBeVisible();
  await expect(page.getByTestId('grid-loader')).toBeHidden();

  const rows = docsGrid.getByRole('row');

  const row = rows.filter({
    hasText: title,
  });

  await expect(row).toBeVisible();

  return row;
};

interface GoToGridDocOptions {
  nthRow?: number;
  title?: string;
}
export const goToGridDoc = async (
  page: Page,
  { nthRow = 1, title }: GoToGridDocOptions = {},
) => {
  const header = page.locator('header').first();
  await header.locator('h2').getByText('Docs').click();

  const docsGrid = page.getByTestId('docs-grid');
  await expect(docsGrid).toBeVisible();
  await expect(page.getByTestId('grid-loader')).toBeHidden();

  const rows = docsGrid.getByRole('row');

  const row = title
    ? rows.filter({
        hasText: title,
      })
    : rows.nth(nthRow);

  await expect(row).toBeVisible();

  const docTitleContent = row.locator('[aria-describedby="doc-title"]').first();
  const docTitle = await docTitleContent.textContent();
  expect(docTitle).toBeDefined();

  await row.getByRole('link').first().click();

  return docTitle as string;
};

export const updateDocTitle = async (page: Page, title: string) => {
  const input = page.getByLabel('doc title input');
  await expect(input).toBeVisible();
  await expect(input).toHaveText('');
  await input.click();
  await input.fill(title);
  await input.click();
  await input.blur();
  await verifyDocName(page, title);
};

export const waitForResponseCreateDoc = (page: Page) => {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/documents/') &&
      response.url().includes('/children/') &&
      response.request().method() === 'POST',
  );
};

export const mockedDocument = async (page: Page, data: object) => {
  await page.route('**/documents/**/', async (route) => {
    const request = route.request();
    if (
      request.method().includes('GET') &&
      !request.url().includes('page=') &&
      !request.url().includes('versions') &&
      !request.url().includes('accesses') &&
      !request.url().includes('invitations')
    ) {
      const { abilities, ...doc } = data as unknown as {
        abilities?: Record<string, unknown>;
      };
      await route.fulfill({
        json: {
          id: 'mocked-document-id',
          content: '',
          title: 'Mocked document',
          path: '000000',
          abilities: {
            destroy: false, // Means not owner
            link_configuration: false,
            versions_destroy: false,
            versions_list: true,
            versions_retrieve: true,
            accesses_manage: false, // Means not admin
            update: false,
            partial_update: false, // Means not editor
            retrieve: true,
            link_select_options: {
              public: ['reader', 'editor'],
              authenticated: ['reader', 'editor'],
              restricted: null,
            },
            ...abilities,
          },
          link_reach: 'restricted',
          computed_link_reach: 'restricted',
          computed_link_role: 'reader',
          ancestors_link_reach: null,
          ancestors_link_role: null,
          created_at: '2021-09-01T09:00:00Z',
          user_role: 'owner',
          ...doc,
        },
      });
    } else {
      await route.continue();
    }
  });
};

export const mockedListDocs = async (page: Page, data: object[] = []) => {
  await page.route('**/documents/**/', async (route) => {
    const request = route.request();
    if (request.method().includes('GET') && request.url().includes('page=')) {
      await route.fulfill({
        json: {
          count: data.length,
          next: null,
          previous: null,
          results: data,
        },
      });
    }
  });
};

export const expectLoginPage = async (page: Page) =>
  await expect(
    page.getByRole('heading', { name: 'Collaborative writing' }),
  ).toBeVisible({
    timeout: 10000,
  });
