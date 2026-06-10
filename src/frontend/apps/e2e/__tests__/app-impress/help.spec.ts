import { expect, test } from '@playwright/test';

import {
  CONFIG,
  TestLanguage,
  getCurrentConfig,
  overrideConfig,
  waitForLanguageSwitch,
} from './utils-common';

const legalLinks = {
  personal_data:
    'https://lasuite.numerique.gouv.fr/legal/docs/donnees-personnelles-cookies',
  terms_of_use:
    'https://lasuite.numerique.gouv.fr/legal/docs/modalite-utilisation',
  accessibility_statement:
    'https://lasuite.numerique.gouv.fr/legal/docs/declaration-accessibilite',
  legal_notice: 'https://lasuite.numerique.gouv.fr/legal/docs',
};

const supportMailto =
  'mailto:support-docs@numerique.gouv.fr?subject=Aide%20Docs%27';

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
      test('is not displayed if support_mailto is not set', async ({
        page,
      }) => {
        await overrideConfig(page, {
          theme_customization: {
            ...CONFIG.theme_customization,
            help: {
              ...CONFIG.theme_customization.help,
              support_mailto: '',
            },
          },
        });

        await page.goto('/');

        await page.getByRole('button', { name: 'Open help menu' }).click();
        await expect(
          page.getByRole('menuitem', { name: 'Get Support' }),
        ).toBeHidden();
      });

      test('is displayed if support_mailto is set', async ({ page }) => {
        await overrideConfig(page, {
          theme_customization: {
            ...CONFIG.theme_customization,
            help: {
              ...CONFIG.theme_customization.help,
              support_mailto: supportMailto,
            },
          },
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
      test('is displayed when support_mailto is configured', async ({
        page,
      }) => {
        const currentConfig = await getCurrentConfig(page);
        test.skip(
          !currentConfig.theme_customization?.help?.support_mailto,
          'Support mailto is not configured',
        );
        await page.goto('/');

        await page.getByRole('button', { name: 'Open help menu' }).click();
        await expect(
          page.getByRole('menuitem', {
            name: 'Get Support',
          }),
        ).toBeVisible();
      });
    }
  });

  test.describe('Legal submenu', () => {
    if (process.env.IS_INSTANCE !== 'true') {
      test('is not displayed if legal_links are not set', async ({ page }) => {
        await overrideConfig(page, {
          theme_customization: {
            ...CONFIG.theme_customization,
            help: {
              ...CONFIG.theme_customization.help,
              legal_links: {
                personal_data: '',
                terms_of_use: '',
                accessibility_statement: '',
                legal_notice: '',
              },
            },
            onboarding: {
              enabled: true,
            },
          },
        });

        await page.goto('/');

        await page.getByRole('button', { name: 'Open help menu' }).click();
        await expect(
          page.getByRole('menuitem', { name: 'Legal' }),
        ).toBeHidden();
      });

      test('is displayed and opens legal links when legal_links are set', async ({
        page,
      }) => {
        await overrideConfig(page, {
          theme_customization: {
            ...CONFIG.theme_customization,
            help: {
              ...CONFIG.theme_customization.help,
              legal_links: legalLinks,
            },
            onboarding: {
              enabled: true,
            },
          },
        });

        await page.goto('/');

        await page.getByRole('button', { name: 'Open help menu' }).click();
        await page.getByRole('menuitem', { name: 'Legal' }).hover();

        await expect(
          page.getByRole('menuitem', { name: 'Personal data and cookies' }),
        ).toBeVisible();
        await expect(
          page.getByRole('menuitem', { name: 'Terms of use' }),
        ).toBeVisible();
        await expect(
          page.getByRole('menuitem', { name: 'Accessibility statement' }),
        ).toBeVisible();
        await expect(
          page.getByRole('menuitem', { name: 'Legal notice' }),
        ).toBeVisible();

        const personalDataItem = page.getByRole('menuitem', {
          name: 'Personal data and cookies',
        });

        const [newPage] = await Promise.all([
          page.context().waitForEvent('page'),
          personalDataItem.click(),
        ]);

        await expect(newPage).toHaveURL(legalLinks.personal_data);
      });
    }

    if (process.env.IS_INSTANCE === 'true') {
      test('is displayed when legal_links are configured', async ({ page }) => {
        const currentConfig = await getCurrentConfig(page);
        const configuredLegalLinks =
          currentConfig.theme_customization?.help?.legal_links;

        test.skip(
          !configuredLegalLinks?.personal_data &&
            !configuredLegalLinks?.terms_of_use &&
            !configuredLegalLinks?.accessibility_statement &&
            !configuredLegalLinks?.legal_notice,
          'Legal links are not configured',
        );

        await page.goto('/');

        await page.getByRole('button', { name: 'Open help menu' }).click();
        await expect(
          page.getByRole('menuitem', { name: 'Legal' }),
        ).toBeVisible();
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
