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

    // Modal is rendered by the UI kit
    const modal = page.getByTestId('onboarding-modal');
    await expect(modal).toBeVisible();

    await expect(page.getByTestId('onboarding-step-0')).toHaveAttribute(
      'tabindex',
      '0',
    );

    // Go to next step and ensure step focusable state updates
    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-step-1')).toHaveAttribute(
      'tabindex',
      '0',
    );

    // Close the modal using Escape (works regardless of close button label)
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });
});
