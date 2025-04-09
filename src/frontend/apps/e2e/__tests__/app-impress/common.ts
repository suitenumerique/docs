import { Page, expect } from '@playwright/test';

export const CONFIG = {
  AI_FEATURE_ENABLED: true,
  CRISP_WEBSITE_ID: null,
  COLLABORATION_WS_URL: 'ws://localhost:4444/collaboration/ws/',
  ENVIRONMENT: 'development',
  FRONTEND_CSS_URL: null,
  FRONTEND_HOMEPAGE_FEATURE_ENABLED: true,
  FRONTEND_FOOTER_FEATURE_ENABLED: true,
  FRONTEND_THEME: 'default',
  MEDIA_BASE_URL: 'http://localhost:8083',
  LANGUAGES: [
    ['en-us', 'English'],
    ['fr-fr', 'Français'],
    ['de-de', 'Deutsch'],
    ['nl-nl', 'Nederlands'],
  ],
  LANGUAGE_CODE: 'en-us',
  POSTHOG_KEY: {},
  SENTRY_DSN: null,
};

export const keyCloakSignIn = async (
  page: Page,
  browserName: string,
  fromHome: boolean = true,
) => {
  if (fromHome) {
    await page
      .getByRole('button', { name: 'Proconnect Login' })
      .first()
      .click();
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
) => {
  const randomDocs = randomName(docName, browserName, length);

  for (let i = 0; i < randomDocs.length; i++) {
    const header = page.locator('header').first();
    await header.locator('h2').getByText('Docs').click();

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
    await expect(input).toHaveText('');
    await input.click();

    await input.fill(randomDocs[i]);
    await input.blur();
  }

  return randomDocs;
};

export const verifyDocName = async (page: Page, docName: string) => {
  const input = page.getByRole('textbox', { name: 'doc title input' });
  try {
    await expect(input).toHaveText(docName);
  } catch {
    await expect(page.getByRole('heading', { name: docName })).toBeVisible();
  }
};

export const addNewMember = async (
  page: Page,
  index: number,
  role: 'Administrator' | 'Owner' | 'Member' | 'Editor' | 'Reader',
  fillText: string = 'user ',
) => {
  const responsePromiseSearchUser = page.waitForResponse(
    (response) =>
      response.url().includes(`/users/?q=${encodeURIComponent(fillText)}`) &&
      response.status() === 200,
  );

  const inputSearch = page.getByRole('combobox', {
    name: 'Quick search input',
  });

  // Select a new user
  await inputSearch.fill(fillText);

  // Intercept response
  const responseSearchUser = await responsePromiseSearchUser;
  const users = (await responseSearchUser.json()) as {
    email: string;
  }[];

  // Choose user
  await page.getByRole('option', { name: users[index].email }).click();

  // Choose a role
  await page.getByLabel('doc-role-dropdown').click();
  await page.getByLabel(role).click();
  await page.getByRole('button', { name: 'Invite' }).click();

  return users[index].email;
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

export const mockedDocument = async (page: Page, json: object) => {
  await page.route('**/documents/**/', async (route) => {
    const request = route.request();
    if (
      request.method().includes('GET') &&
      !request.url().includes('page=') &&
      !request.url().includes('versions') &&
      !request.url().includes('accesses') &&
      !request.url().includes('invitations')
    ) {
      await route.fulfill({
        json: {
          id: 'mocked-document-id',
          content: '',
          title: 'Mocked document',
          accesses: [],
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
          },
          link_reach: 'restricted',
          created_at: '2021-09-01T09:00:00Z',
          ...json,
        },
      });
    } else {
      await route.continue();
    }
  });
};

export const mockedInvitations = async (page: Page, json?: object) => {
  await page.route('**/invitations/**/', async (route) => {
    const request = route.request();
    if (
      request.method().includes('GET') &&
      request.url().includes('invitations') &&
      request.url().includes('page=')
    ) {
      await route.fulfill({
        json: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: '120ec765-43af-4602-83eb-7f4e1224548a',
              abilities: {
                destroy: true,
                update: true,
                partial_update: true,
                retrieve: true,
              },
              created_at: '2024-10-03T12:19:26.107687Z',
              email: 'test@invitation.test',
              document: '4888c328-8406-4412-9b0b-c0ba5b9e5fb6',
              role: 'editor',
              issuer: '7380f42f-02eb-4ad5-b8f0-037a0e66066d',
              is_expired: false,
              ...json,
            },
          ],
        },
      });
    } else {
      await route.continue();
    }
  });
};

export const mockedAccesses = async (page: Page, json?: object) => {
  await page.route('**/accesses/**/', async (route) => {
    const request = route.request();
    if (
      request.method().includes('GET') &&
      request.url().includes('accesses') &&
      request.url().includes('page=')
    ) {
      await route.fulfill({
        json: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 'bc8bbbc5-a635-4f65-9817-fd1e9ec8ef87',
              user: {
                id: 'b4a21bb3-722e-426c-9f78-9d190eda641c',
                email: 'test@accesses.test',
              },
              team: '',
              role: 'reader',
              abilities: {
                destroy: true,
                update: true,
                partial_update: true,
                retrieve: true,
                set_role_to: ['administrator', 'editor'],
              },
              ...json,
            },
          ],
        },
      });
    } else {
      await route.continue();
    }
  });
};

export const expectLoginPage = async (page: Page) =>
  await expect(
    page.getByRole('heading', { name: 'Collaborative writing' }),
  ).toBeVisible();
