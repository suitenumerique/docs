import { Locator, Page, expect } from '@playwright/test';

export type UserSearchResult = {
  email: string;
  full_name?: string | null;
};

export type Role = 'Administrator' | 'Owner' | 'Member' | 'Editor' | 'Reader';
export type LinkReach = 'Private' | 'Connected' | 'Public';
export type LinkRole = 'Reading' | 'Edition';

export const searchUserToInviteToDoc = async (
  page: Page,
  inputFill?: string,
): Promise<UserSearchResult[]> => {
  const inputFillValue = inputFill ?? 'user ';

  const responsePromise = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(`/users/?q=${encodeURIComponent(inputFillValue)}`) &&
      response.status() === 200,
  );

  await page.getByRole('button', { name: 'Share' }).click();
  const inputSearch = page.getByRole('combobox', {
    name: 'Quick search input',
  });
  await expect(inputSearch).toBeVisible();
  await inputSearch.fill(inputFillValue);
  const response = await responsePromise;
  const users = (await response.json()) as UserSearchResult[];
  return users;
};

export const addMemberToDoc = async (
  page: Page,
  role: Role,
  users: UserSearchResult[],
) => {
  const list = page.getByTestId('doc-share-add-member-list');
  await expect(list).toBeHidden();
  const quickSearchContent = page.getByTestId('doc-share-quick-search');
  for (const user of users) {
    await quickSearchContent
      .getByTestId(`search-user-row-${user.email}`)
      .click();
  }

  await list.getByLabel('doc-role-dropdown').click();
  await expect(page.getByLabel(role)).toBeVisible();
  await page.getByLabel(role).click();
  await page.getByRole('button', { name: 'Invite' }).click();
};

export const verifyMemberAddedToDoc = async (
  page: Page,
  user: UserSearchResult,
  role: Role,
): Promise<Locator> => {
  const container = page.getByLabel('List members card');
  await expect(container).toBeVisible();
  const userRow = container.getByTestId(`doc-share-member-row-${user.email}`);
  await expect(userRow).toBeVisible();
  await expect(userRow.getByText(role)).toBeVisible();
  await expect(userRow.getByText(user.full_name || user.email)).toBeVisible();
  return userRow;
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

export const verifyLinkReachIsDisabled = async (
  page: Page,
  linkReach: LinkReach,
) => {
  await page.getByRole('button', { name: 'Visibility', exact: true }).click();
  const item = page.getByRole('menuitem', { name: linkReach });
  await expect(item).toBeDisabled();
  await page.click('body');
};

export const verifyLinkReachIsEnabled = async (
  page: Page,
  linkReach: LinkReach,
) => {
  await page.getByRole('button', { name: 'Visibility', exact: true }).click();
  const item = page.getByRole('menuitem', { name: linkReach });
  await expect(item).toBeEnabled();
  await page.click('body');
};

export const verifyLinkRoleIsDisabled = async (
  page: Page,
  linkRole: LinkRole,
) => {
  await page
    .getByRole('button', { name: 'Visibility mode', exact: true })
    .click();
  const item = page.getByRole('menuitem', { name: linkRole });
  await expect(item).toBeDisabled();
  await page.click('body');
};

export const verifyLinkRoleIsEnabled = async (
  page: Page,
  linkRole: LinkRole,
) => {
  await page
    .getByRole('button', { name: 'Visibility mode', exact: true })
    .click();
  const item = page.getByRole('menuitem', { name: linkRole });
  await expect(item).toBeEnabled();
  await page.click('body');
};

export const verifyShareLink = async (
  page: Page,
  linkReach: LinkReach,
  linkRole?: LinkRole | null,
) => {
  const visibilityDropdownButton = page.getByRole('button', {
    name: 'Visibility',
    exact: true,
  });
  await expect(visibilityDropdownButton).toBeVisible();
  await expect(visibilityDropdownButton.getByText(linkReach)).toBeVisible();

  if (linkRole) {
    const visibilityModeButton = page.getByRole('button', {
      name: 'Visibility mode',
      exact: true,
    });
    await expect(visibilityModeButton).toBeVisible();
    await expect(page.getByText(linkRole)).toBeVisible();
  }
};
