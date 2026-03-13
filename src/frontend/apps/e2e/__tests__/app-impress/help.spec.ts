import { expect, test } from '@playwright/test';

import {
  TestLanguage,
  overrideConfig,
  waitForLanguageSwitch,
} from './utils-common';

test.describe('Help feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Onboarding modal', () => {
    test('Help menu not displayed if onboarding is disabled', async ({
      page,
    }) => {
      await overrideConfig(page, {
        theme_customization: {
          onboarding: {
            enabled: false,
          },
        },
      });

      await expect(page.getByRole('button', { name: 'New doc' })).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'Open onboarding menu' }),
      ).toBeHidden();
    });

    test('opens onboarding modal from help menu and can navigate/close', async ({
      page,
    }) => {
      await overrideConfig(page, {
        theme_customization: {
          onboarding: {
            enabled: true,
            learn_more_url: 'https://example.com/learn-more',
          },
        },
      });

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
      await expect(learnMoreLink).toHaveAttribute(
        'href',
        'https://example.com/learn-more',
      );
      await learnMoreLink.click();

      await page.getByRole('button', { name: /understood/i }).click();
      await expect(modal).toBeHidden();
    });

    test('closes modal with Skip button', async ({ page }) => {
      await page.getByRole('button', { name: 'Open onboarding menu' }).click();
      await page.getByRole('menuitem', { name: 'Onboarding' }).click();

      const modal = page.getByTestId('onboarding-modal');
      await expect(modal).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: 'Learn more docs features',
        }),
      ).toBeHidden();

      await page.getByRole('button', { name: /skip/i }).click();
      await expect(modal).toBeHidden();
    });

    test('Modal onboarding translated correctly', async ({ page }) => {
      // switch to french
      await waitForLanguageSwitch(page, TestLanguage.French);

      await page.getByRole('button', { name: 'Open onboarding menu' }).click();

      await page.getByRole('menuitem', { name: 'Onboarding' }).click();

      const modal = page.getByLabel('Apprenez les principes fondamentaux');

      await expect(modal.getByText('Découvrez Docs')).toBeVisible();
      await expect(
        modal.getByText(/Rédigez votre document facilement/).first(),
      ).toBeVisible();
      await expect(
        modal.getByText(/Déplacez, dupliquez/).first(),
      ).toBeVisible();
      await expect(
        modal.getByRole('button', { name: /Passer/i }),
      ).toBeVisible();
      await expect(
        modal.getByRole('button', { name: /Suivant/i }),
      ).toBeVisible();
    });

    test('Modal is displayed automatically on first connection', async ({
      page,
      browserName,
    }) => {
      await expect(page.getByRole('button', { name: 'New doc' })).toBeVisible();
      await expect(page.getByTestId('onboarding-modal')).toBeHidden();

      await page.route(/.*\/api\/v1.0\/users\/me\//, async (route) => {
        const request = route.request();
        if (request.method().includes('GET')) {
          await route.fulfill({
            json: {
              id: 'f2bfcf0b-e4b9-4153-b2e5-0d2a9a5a0a5b',
              email: `user.test@${browserName.toLowerCase()}.test`,
              full_name: `E2E ${browserName}`,
              short_name: 'E2E',
              language: 'en-us',
              is_first_connection: true,
            },
          });
        } else {
          await route.continue();
        }
      });

      let onboardingDoneCalled = false;
      await page.route(
        /.*\/api\/v1.0\/users\/onboarding-done\//,
        async (route) => {
          const request = route.request();
          if (request.method().includes('POST')) {
            onboardingDoneCalled = true;
            await route.continue();
          }
        },
      );

      await page.goto('/');

      await expect(page.getByTestId('onboarding-modal')).toBeVisible();

      await page.getByRole('button', { name: /skip/i }).click();

      await expect(page.getByTestId('onboarding-modal')).toBeHidden();
      expect(onboardingDoneCalled).toBeTruthy();
    });
  });
});
