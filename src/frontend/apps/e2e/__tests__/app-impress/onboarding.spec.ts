import { expect, test } from '@playwright/test';

test.describe('Onboarding modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('left-panel-desktop')).toBeVisible();
  });

  test('opens onboarding modal from help menu and can navigate/close', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Open onboarding menu' }).click();

    await page.getByRole('menuitem', { name: 'Onboarding' }).click();

    const modal = page.getByTestId('onboarding-modal');
    await expect(modal).toBeVisible();

    await expect(page.getByTestId('onboarding-step-0')).toHaveAttribute(
      'tabindex',
      '0',
    );

    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-step-1')).toHaveAttribute(
      'tabindex',
      '0',
    );

    await page.getByTestId('onboarding-step-2').click();
    await expect(page.getByTestId('onboarding-step-2')).toHaveAttribute(
      'tabindex',
      '0',
    );

    await page.getByTestId('onboarding-step-3').click();
    await expect(page.getByTestId('onboarding-step-3')).toHaveAttribute(
      'tabindex',
      '0',
    );

    const learnMoreLink = page.getByRole('link', {
      name: 'Learn more docs features',
    });
    await expect(learnMoreLink).toBeVisible();
    await learnMoreLink.click();

    await page.getByRole('button', { name: /understood|compris/i }).click();
    await expect(modal).toBeHidden();
  });

  test('closes modal with Skip button', async ({ page }) => {
    await page.getByRole('button', { name: 'Open onboarding menu' }).click();
    await page.getByRole('menuitem', { name: 'Onboarding' }).click();

    const modal = page.getByTestId('onboarding-modal');
    await expect(modal).toBeVisible();

    await page.getByRole('button', { name: /skip/i }).click();
    await expect(modal).toBeHidden();
  });
});
