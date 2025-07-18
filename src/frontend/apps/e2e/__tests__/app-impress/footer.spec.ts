import { expect, test } from '@playwright/test';

import { overrideConfig } from './utils-common';

test.describe('Footer', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('checks the footer is not displayed if no config', async ({ page }) => {
    await overrideConfig(page, {
      theme_customization: {},
    });

    await page.goto('/');
    await expect(page.locator('footer')).toBeHidden();
  });

  test('checks all the elements are visible', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer').first();

    await expect(footer.getByAltText('Docs Logo')).toBeVisible();
    await expect(footer.getByRole('heading', { name: 'Docs' })).toBeVisible();

    await expect(footer.getByRole('link', { name: 'Github' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'DINUM' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'ZenDiS' })).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'BlockNote.js' }),
    ).toBeVisible();
    await expect(
      footer.getByRole('link', { name: 'Legal Notice' }),
    ).toBeVisible();
    await expect(
      footer.getByRole('link', { name: 'Personal data and cookies' }),
    ).toBeVisible();
    await expect(
      footer.getByRole('link', { name: 'Accessibility' }),
    ).toBeVisible();

    await expect(
      footer.getByText(
        'Unless otherwise stated, all content on this site is under licence',
      ),
    ).toBeVisible();

    // Check the translation
    const header = page.locator('header').first();
    await header.getByRole('button').getByText('English').click();
    await page.getByLabel('Français').click();

    await expect(
      page.locator('footer').getByText('Mentions légales'),
    ).toBeVisible();
  });

  test('checks the footer is correctly overrided', async ({ page }) => {
    await overrideConfig(page, {
      FRONTEND_THEME: 'dsfr',
      theme_customization: {
        footer: {
          default: {
            logo: {
              src: '/assets/logo-gouv.svg',
              width: '220px',
              alt: 'Gouvernement Logo',
            },
            externalLinks: [
              {
                label: 'legifrance.gouv.fr',
                href: '#',
              },
              {
                label: 'info.gouv.fr',
                href: '#',
              },
            ],
            legalLinks: [
              {
                label: 'Legal link',
                href: '#',
              },
            ],
            bottomInformation: {
              label: 'Some bottom information text',
              link: {
                label: 'a custom label',
                href: '#',
              },
            },
          },
          fr: {
            bottomInformation: {
              label: "Text d'information en bas de page en français",
              link: {
                label: 'un label personnalisé',
                href: '#',
              },
            },
          },
        },
      },
    });

    await page.goto('/');
    const footer = page.locator('footer').first();

    await expect(footer.getByAltText('Gouvernement Logo')).toBeVisible();

    await expect(footer.getByRole('heading', { name: 'Docs' })).toBeHidden();

    await expect(
      footer.getByRole('link', { name: 'legifrance.gouv.fr' }),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'info.gouv.fr' }),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'Legal link' }),
    ).toBeVisible();

    await expect(
      footer.getByText('Some bottom information text'),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'a custom label' }),
    ).toBeVisible();

    // Check the translation
    const header = page.locator('header').first();
    await header.getByRole('button').getByText('English').click();
    await page.getByLabel('Français').click();

    await expect(
      page
        .locator('footer')
        .getByText("Text d'information en bas de page en français"),
    ).toBeVisible();

    await expect(
      footer.getByRole('link', { name: 'un label personnalisé' }),
    ).toBeVisible();
  });
});
