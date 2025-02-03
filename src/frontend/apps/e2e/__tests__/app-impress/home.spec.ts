import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/docs/');
});

test.describe('Home page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('checks all the elements are visible', async ({ page }) => {
    // Check header content
    const header = page.locator('header').first();
    const footer = page.locator('footer').first();
    await expect(header).toBeVisible();
    await expect(
      header.getByRole('combobox', { name: 'Language' }),
    ).toBeVisible();
    await expect(
      header.getByRole('button', { name: 'Les services de La Suite numé' }),
    ).toBeVisible();
    await expect(
      header.getByRole('img', { name: 'Gouvernement Logo' }),
    ).toBeVisible();
    await expect(
      header.getByRole('img', { name: 'Docs app logo' }),
    ).toBeVisible();
    await expect(header.getByRole('heading', { name: 'Docs' })).toBeVisible();
    await expect(header.getByText('BETA')).toBeVisible();

    // Check the ttile and subtitle are visible
    await expect(page.getByText('Collaborative writing made')).toBeVisible();
    await expect(page.getByText('Collaborate and write in real')).toBeVisible();
    await expect(page.getByText('An uncompromising writing')).toBeVisible();
    await expect(page.getByText('Docs offers an intuitive')).toBeVisible();
    await expect(page.getByText('Simple and secure')).toBeVisible();
    await expect(page.getByText('Docs makes real-time')).toBeVisible();
    await expect(page.getByText('Flexible export.')).toBeVisible();
    await expect(page.getByText('To facilitate the circulation')).toBeVisible();
    await expect(page.getByText('A new way to organize')).toBeVisible();
    await expect(page.getByText('Docs transforms your')).toBeVisible();

    await expect(page.getByTestId('proconnect-button')).toHaveCount(2);

    // Footer - The footer is already tested in its entirety in the footer.spec.ts file
    await expect(footer).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'expand_more See more' }),
    ).toBeVisible();
  });
});
