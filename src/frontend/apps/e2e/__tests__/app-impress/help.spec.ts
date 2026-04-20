import { expect, test } from '@playwright/test';

import {
  TestLanguage,
  getCurrentConfig,
  overrideConfig,
  waitForLanguageSwitch,
} from './utils-common';

test.describe('Help feature', () => {
  test.describe('Documentation button', () => {
    if (process.env.IS_INSTANCE !== 'true') {
      test('is not displayed if documentation_url is not set', async ({
        page,
      }) => {
        await overrideConfig(page, {
          theme_customization: {
            help: {
              documentation_url: '',
            },
            onboarding: {
              enabled: true,
            },
          },
        });

        await page.goto('/');

        await page.getByRole('button', { name: 'Open help menu' }).click();
        await expect(
          page.getByRole('menuitem', { name: 'Documentation' }),
        ).toBeHidden();
      });
    }

    test('is displayed if documentation_url is set', async ({ page }) => {
      let documentationUrl: string;

      if (process.env.IS_INSTANCE !== 'true') {
        documentationUrl = `${process.env.BASE_URL}/docs/`;
        await overrideConfig(page, {
          theme_customization: {
            help: {
              documentation_url: documentationUrl,
            },
          },
        });
      } else {
        const currentConfig = await getCurrentConfig(page);
        test.skip(
          !currentConfig.theme_customization?.help?.documentation_url,
          'Documentation URL is not set',
        );
        documentationUrl =
          currentConfig.theme_customization.help.documentation_url;
      }

      await page.goto('/');

      await page.getByRole('button', { name: 'Open help menu' }).click();
      const docMenuItem = page.getByRole('menuitem', { name: 'Documentation' });
      await expect(docMenuItem).toBeVisible();

      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        docMenuItem.click(),
      ]);

      await expect(newPage).toHaveURL(documentationUrl);
    });
  });

  test.describe('Support button', () => {
    if (process.env.IS_INSTANCE !== 'true') {
      test('is not displayed if CRISP_WEBSITE_ID is not set', async ({
        page,
      }) => {
        await overrideConfig(page, {
          CRISP_WEBSITE_ID: '',
        });

        await page.goto('/');

        await page.getByRole('button', { name: 'Open help menu' }).click();
        await expect(
          page.getByRole('menuitem', { name: 'Get Support' }),
        ).toBeHidden();
      });

      test('is displayed if CRISP_WEBSITE_ID is set', async ({ page }) => {
        await overrideConfig(page, {
          CRISP_WEBSITE_ID: 'test_website_id',
        });

        await page.goto('/');

        await page.getByRole('button', { name: 'Open help menu' }).click();
        await expect(
          page.getByRole('menuitem', {
            name: 'Get Support',
          }),
        ).toBeVisible();
      });
    }

    if (process.env.IS_INSTANCE === 'true') {
      test('it displays Crisp chatbox', async ({ page }) => {
        const currentConfig = await getCurrentConfig(page);
        test.skip(
          !currentConfig.CRISP_WEBSITE_ID,
          'Crisp chatbox is not enabled',
        );
        await page.goto('/');

        await page.getByRole('button', { name: 'Open help menu' }).click();
        await page
          .getByRole('menuitem', {
            name: 'Get Support',
          })
          .click();

        const crispElement = page.locator('#crisp-chatbox');
        await expect(crispElement).toBeAttached();
      });
    }
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

      await page.goto('/');

      await expect(page.getByRole('button', { name: 'New doc' })).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'Open help menu' }),
      ).toBeHidden();
    });

    test('opens onboarding modal from help menu and can navigate/close', async ({
      page,
    }) => {
      await overrideConfig(page, {
        theme_customization: {
          onboarding: {
            enabled: true,
            learn_more_url: 'http://localhost:3000/learn-more',
            ready_template_url: 'http://localhost:3000/ready-template',
          },
        },
      });

      await page.goto('/');

      await page.getByRole('button', { name: 'Open help menu' }).click();

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

      const step3 = page.getByTestId('onboarding-step-3');
      await step3.click();
      await expect(step3).toHaveAttribute('tabindex', '0');
      await expect(
        step3.getByRole('link', { name: 'ready-made template' }),
      ).toHaveAttribute('href', 'http://localhost:3000/ready-template');

      const learnMoreLink = page.getByRole('link', {
        name: 'Learn more docs features',
      });
      await expect(learnMoreLink).toHaveAttribute(
        'href',
        'http://localhost:3000/learn-more',
      );
      await learnMoreLink.click();

      await page.getByRole('button', { name: /understood/i }).click();
      await expect(modal).toBeHidden();
    });

    test('closes modal with Skip button', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('button', { name: 'Open help menu' }).click();
      await page.getByRole('menuitem', { name: 'Onboarding' }).click();

      const modal = page.getByTestId('onboarding-modal');
      await expect(modal).toBeVisible();

      await page.getByRole('button', { name: /skip/i }).click();
      await expect(modal).toBeHidden();
    });

    test('Modal onboarding translated correctly', async ({ page }) => {
      await page.goto('/');

      // switch to french
      await waitForLanguageSwitch(page, TestLanguage.French);

      await page.getByRole('button', { name: "Ouvrir le menu d'aide" }).click();

      await page.getByRole('menuitem', { name: 'Premiers pas' }).click();

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
      await modal
        .getByText(/Tirez parti de la bibliothèque de contenu/)
        .first()
        .click();
      await expect(
        modal.getByText(/Commencez à partir de/).first(),
      ).toBeVisible();
      await expect(modal.getByRole('link')).toHaveText(
        "modèles prêts à l'emploi",
      );
    });

    test('Modal is displayed automatically on first connection', async ({
      page,
      browserName,
    }) => {
      await page.goto('/');

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
