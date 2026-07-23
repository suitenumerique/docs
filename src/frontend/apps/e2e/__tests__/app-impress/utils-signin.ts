import { Page, expect } from '@playwright/test';

export const SignIn = async (
  page: Page,
  browserName: string,
  fromHome = true,
) => {
  if (process.env.CUSTOM_SIGN_IN === 'true') {
    await customSignIn(page, browserName, fromHome);
    return;
  }

  await keycloakSignIn(page, browserName, fromHome);
};

export const logOut = async (page: Page) => {
  await page.getByLabel('User menu').click();
  await page.getByText('Logout', { exact: true }).click();
};

export const customSignIn = async (
  page: Page,
  browserName: string,
  fromHome = true,
) => {
  // Check if already signed in (Silent login or session still valid)
  if (await page.getByLabel('User menu').isVisible()) {
    return;
  }

  if (fromHome) {
    await page
      .getByRole('button', { name: process.env.SIGN_IN_EL_TRIGGER })
      .first()
      .click();
  }

  await page
    .getByRole('textbox', { name: process.env.SIGN_IN_EL_USERNAME_INPUT })
    .fill(process.env[`SIGN_IN_USERNAME_${browserName.toUpperCase()}`] || '');

  if (process.env.SIGN_IN_EL_USERNAME_VALIDATION) {
    await page
      .getByRole('button', { name: process.env.SIGN_IN_EL_USERNAME_VALIDATION })
      .first()
      .click();
  }

  await page
    .locator(
      `input[name="${process.env.SIGN_IN_EL_PASSWORD_INPUT || 'password'}"]`,
    )
    .fill(process.env[`SIGN_IN_PASSWORD_${browserName.toUpperCase()}`] || '');

  await page.click('button[type="submit"]', { force: true });
};

export const keycloakSignIn = async (
  page: Page,
  browserName: string,
  fromHome = true,
) => {
  if (fromHome) {
    await page
      .getByRole('button', { name: process.env.SIGN_IN_EL_TRIGGER })
      .first()
      .click();
  }

  const login = `user-e2e-${browserName}`;
  const password = `password-e2e-${browserName}`;

  await expect(
    page.locator('.login-pf #kc-header-wrapper').getByText('impress'),
  ).toBeVisible();

  if (await page.getByLabel('Restart login').isVisible()) {
    await page.getByLabel('Restart login').click();
  }

  await page.getByRole('textbox', { name: 'username' }).fill(login);
  await page.getByRole('textbox', { name: 'password' }).fill(password);
  await page.click('button[type="submit"]', { force: true });
};

export const expectLoginPage = async (page: Page) =>
  await expect(
    page.getByRole('heading', { name: 'Collaborative writing' }),
  ).toBeVisible({
    timeout: 10000,
  });
