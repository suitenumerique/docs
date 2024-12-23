import { expect, test } from '@playwright/test';

import { createDoc, randomName } from './common';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Document create member', () => {
  test('it selects 2 users and 1 invitation', async ({ page, browserName }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/users/?q=user') && response.status() === 200,
    );
    await createDoc(page, 'select-multi-users', browserName, 1);

    await page.getByRole('button', { name: 'Share' }).click();

    const inputSearch = page.getByRole('combobox', {
      name: 'Quick search input',
    });
    await expect(inputSearch).toBeVisible();

    // Select user 1 and verify tag
    await inputSearch.fill('user');
    const response = await responsePromise;
    const users = (await response.json()).results as {
      email: string;
      full_name: string;
    }[];

    const list = page.getByTestId('doc-share-add-member-list');
    await expect(list).toBeHidden();
    const quickSearchContent = page.getByTestId('doc-share-quick-search');
    await quickSearchContent
      .getByTestId(`search-user-row-${users[0].email}`)
      .click();

    await expect(list).toBeVisible();
    await expect(
      list.getByTestId(`doc-share-add-member-${users[0].email}`),
    ).toBeVisible();
    await expect(list.getByText(`${users[0].full_name}`)).toBeVisible();

    // Select user 2 and verify tag
    await inputSearch.fill('user');
    await quickSearchContent
      .getByTestId(`search-user-row-${users[1].email}`)
      .click();

    await expect(
      list.getByTestId(`doc-share-add-member-${users[1].email}`),
    ).toBeVisible();
    await expect(list.getByText(`${users[1].full_name}`)).toBeVisible();

    // Select email and verify tag
    const email = randomName('test@test.fr', browserName, 1)[0];
    await inputSearch.fill(email);
    await quickSearchContent.getByText(email).click();
    await expect(list.getByText(email)).toBeVisible();

    // Check roles are displayed
    await list.getByLabel('doc-role-dropdown').click();
    await expect(page.getByRole('button', { name: 'Reader' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editor' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Owner' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Administrator' }),
    ).toBeVisible();

    // Validate
    await page.getByRole('button', { name: 'Administrator' }).click();
    await page.getByRole('button', { name: 'Invite' }).click();

    // Check invitation added
    await expect(
      quickSearchContent.getByText('Pending invitations'),
    ).toBeVisible();
    await expect(quickSearchContent.getByText(email).first()).toBeVisible();

    // Check user added
    await expect(page.getByText('Share with 3 users')).toBeVisible();
    await expect(
      quickSearchContent.getByText(users[0].full_name).first(),
    ).toBeVisible();
    await expect(
      quickSearchContent.getByText(users[0].email).first(),
    ).toBeVisible();
    await expect(
      quickSearchContent.getByText(users[1].email).first(),
    ).toBeVisible();
    await expect(
      quickSearchContent.getByText(users[1].full_name).first(),
    ).toBeVisible();
  });

  test('it try to add twice the same invitation', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'invitation-twice', browserName, 1);

    await page.getByRole('button', { name: 'Share' }).click();

    const inputSearch = page.getByRole('combobox', {
      name: 'Quick search input',
    });

    const [email] = randomName('test@test.fr', browserName, 1);
    await inputSearch.fill(email);
    await page.getByTestId(`search-user-row-${email}`).click();

    // Choose a role
    const container = page.getByTestId('doc-share-add-member-list');
    await container.getByLabel('doc-role-dropdown').click();
    await page.getByRole('button', { name: 'Owner' }).click();

    const responsePromiseCreateInvitation = page.waitForResponse(
      (response) =>
        response.url().includes('/invitations/') && response.status() === 201,
    );
    await page.getByRole('button', { name: 'Invite' }).click();

    // Check invitation sent

    const responseCreateInvitation = await responsePromiseCreateInvitation;
    expect(responseCreateInvitation.ok()).toBeTruthy();

    await inputSearch.fill(email);
    await page.getByTestId(`search-user-row-${email}`).click();

    // Choose a role
    await container.getByLabel('doc-role-dropdown').click();
    await page.getByRole('button', { name: 'Owner' }).click();

    const responsePromiseCreateInvitationFail = page.waitForResponse(
      (response) =>
        response.url().includes('/invitations/') && response.status() === 400,
    );

    await page.getByRole('button', { name: 'Invite' }).click();
    await expect(
      page.getByText(`"${email}" is already invited to the document.`),
    ).toBeVisible();
    const responseCreateInvitationFail =
      await responsePromiseCreateInvitationFail;
    expect(responseCreateInvitationFail.ok()).toBeFalsy();
  });

  test('The invitation endpoint get the language of the website', async ({
    page,
    browserName,
  }) => {
    await createDoc(page, 'user-invitation', browserName, 1);

    const header = page.locator('header').first();
    await header.getByRole('combobox').getByText('EN').click();
    await header.getByRole('option', { name: 'translate Français' }).click();

    await page.getByRole('button', { name: 'Partager' }).click();

    const inputSearch = page.getByRole('combobox', {
      name: 'Quick search input',
    });

    const email = randomName('test@test.fr', browserName, 1)[0];
    await inputSearch.fill(email);
    await page.getByTestId(`search-user-row-${email}`).click();

    // Choose a role
    const container = page.getByTestId('doc-share-add-member-list');
    await container.getByLabel('doc-role-dropdown').click();
    await page.getByRole('button', { name: 'Administrateur' }).click();

    const responsePromiseCreateInvitation = page.waitForResponse(
      (response) =>
        response.url().includes('/invitations/') && response.status() === 201,
    );

    await page.getByRole('button', { name: 'Invite' }).click();

    // Check invitation sent

    const responseCreateInvitation = await responsePromiseCreateInvitation;
    expect(responseCreateInvitation.ok()).toBeTruthy();
    expect(
      responseCreateInvitation.request().headers()['content-language'],
    ).toBe('fr-fr');
  });

  test('it manages invitation', async ({ page, browserName }) => {
    await createDoc(page, 'user-invitation', browserName, 1);

    await page.getByRole('button', { name: 'Share' }).click();

    const inputSearch = page.getByRole('combobox', {
      name: 'Quick search input',
    });

    const email = randomName('test@test.fr', browserName, 1)[0];
    await inputSearch.fill(email);
    await page.getByTestId(`search-user-row-${email}`).click();

    // Choose a role
    const container = page.getByTestId('doc-share-add-member-list');
    await container.getByLabel('doc-role-dropdown').click();
    await page.getByRole('button', { name: 'Administrator' }).click();

    const responsePromiseCreateInvitation = page.waitForResponse(
      (response) =>
        response.url().includes('/invitations/') && response.status() === 201,
    );

    await page.getByRole('button', { name: 'Invite' }).click();

    // Check invitation sent
    const responseCreateInvitation = await responsePromiseCreateInvitation;
    expect(responseCreateInvitation.ok()).toBeTruthy();

    const listInvitation = page.getByTestId('doc-share-quick-search');
    const userInvitation = listInvitation.getByTestId(
      `doc-share-invitation-row-${email}`,
    );
    await expect(userInvitation).toBeVisible();

    await userInvitation.getByLabel('doc-role-dropdown').click();
    await page.getByRole('button', { name: 'Reader' }).click();

    const moreActions = userInvitation.getByRole('button', {
      name: 'more_horiz',
    });
    await moreActions.click();

    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(userInvitation).toBeHidden();
  });
});
