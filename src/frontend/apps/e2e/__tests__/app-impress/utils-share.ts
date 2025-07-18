import { Page, expect } from '@playwright/test';

export type Role = 'Administrator' | 'Owner' | 'Member' | 'Editor' | 'Reader';
export type LinkReach = 'Private' | 'Connected' | 'Public';
export type LinkRole = 'Reading' | 'Edition';

export const addNewMember = async (
  page: Page,
  index: number,
  role: 'Administrator' | 'Owner' | 'Editor' | 'Reader',
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

export const updateShareLink = async (
  page: Page,
  linkReach: LinkReach,
  linkRole?: LinkRole | null,
) => {
  await page.getByRole('button', { name: 'Visibility', exact: true }).click();
  await page.getByRole('menuitem', { name: linkReach }).click();

  const visibilityUpdatedText = page
    .getByText('The document visibility has been updated')
    .first();

  await expect(visibilityUpdatedText).toBeVisible();

  if (linkRole) {
    await page
      .getByRole('button', { name: 'Visibility mode', exact: true })
      .click();
    await page.getByRole('menuitem', { name: linkRole }).click();
    await expect(visibilityUpdatedText).toBeVisible();
  }
};

export const mockedInvitations = async (page: Page, json?: object) => {
  let result = [
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
  ];
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
          results: result,
        },
      });
    } else {
      await route.continue();
    }
  });

  await page.route(
    '**/invitations/120ec765-43af-4602-83eb-7f4e1224548a/**/',
    async (route) => {
      const request = route.request();
      if (request.method().includes('DELETE')) {
        result = [];

        await route.fulfill({
          json: {},
        });
      }
    },
  );
};

export const mockedAccesses = async (page: Page, json?: object) => {
  await page.route('**/accesses/**/', async (route) => {
    const request = route.request();

    if (
      request.method().includes('GET') &&
      request.url().includes('accesses')
    ) {
      await route.fulfill({
        json: [
          {
            id: 'bc8bbbc5-a635-4f65-9817-fd1e9ec8ef87',
            user: {
              id: 'b4a21bb3-722e-426c-9f78-9d190eda641c',
              email: 'test@accesses.test',
            },
            team: '',
            max_ancestors_role: null,
            max_role: 'reader',
            role: 'reader',
            document: {
              id: 'mocked-document-id',
              path: '000000',
              depth: 1,
            },
            abilities: {
              destroy: true,
              update: true,
              partial_update: true,
              retrieve: true,
              link_select_options: {
                public: ['reader', 'editor'],
                authenticated: ['reader', 'editor'],
                restricted: null,
              },
              set_role_to: ['administrator', 'editor'],
            },
            ...json,
          },
        ],
      });
    } else {
      await route.continue();
    }
  });
};
