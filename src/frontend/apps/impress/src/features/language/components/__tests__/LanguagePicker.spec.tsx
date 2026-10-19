import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { LanguagePicker, LanguagePickerLegacy } from '../LanguagePicker';

const LANGUAGES = [
  ['en-us', 'English'],
  ['fr-fr', 'Français'],
  ['zh-cn', '中文'],
  ['zh-tw', '繁體中文'],
];

const updateUser = vi.fn();

vi.mock('@/core', async () => {
  const actual = await vi.importActual('@/core');

  return {
    ...actual,
    useConfig: () => ({ data: { LANGUAGES } }),
  };
});

vi.mock('@/core/config/api/useConfig', () => ({
  useConfig: () => ({ data: { LANGUAGES } }),
}));

vi.mock('@/core/api/useUserUpdate', () => ({
  useUserUpdate: () => ({ mutateAsync: updateUser }),
}));

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual('@/features/auth');

  return {
    ...actual,
    useAuthQuery: () => ({
      data: { id: 'user-1', language: 'zh-tw' },
    }),
  };
});

const kitSelection = () =>
  Array.from(document.querySelectorAll('.c__dropdown-menu-item__check')).map(
    (check) => check.closest('[role="menuitem"]')?.textContent,
  );

const legacySelection = () =>
  screen
    .getAllByRole('menuitemradio')
    .filter((item) => item.getAttribute('aria-checked') === 'true')
    .map((item) => item.textContent?.replace('check', ''));

describe.each([
  ['LanguagePicker', LanguagePicker, 'menuitem', kitSelection],
  [
    'LanguagePickerLegacy',
    LanguagePickerLegacy,
    'menuitemradio',
    legacySelection,
  ],
] as const)('<%s />', (_name, Picker, itemRole, getSelection) => {
  beforeEach(async () => {
    updateUser.mockReset();
    updateUser.mockResolvedValue({});
    await i18next.changeLanguage('zh-tw');
  });

  afterEach(async () => {
    await i18next.changeLanguage('en');
  });

  const openPicker = async () => {
    render(<Picker />, { wrapper: AppWrapper });
    await userEvent.click(screen.getByRole('button'));
  };

  it('marks a single language as selected', async () => {
    await openPicker();

    expect(getSelection()).toEqual(['繁體中文']);
  });

  it('switches from zh-tw to English and keeps it', async () => {
    await openPicker();

    await userEvent.click(screen.getByRole(itemRole, { name: 'English' }));

    await waitFor(() => {
      expect(i18next.language).toBe('en');
    });
    expect(updateUser).toHaveBeenCalledWith({
      id: 'user-1',
      language: 'en-us',
    });

    // The picker follows the language and still shows a single selection
    await userEvent.click(screen.getByRole('button'));
    expect(getSelection()).toEqual(['English']);
  });
});
