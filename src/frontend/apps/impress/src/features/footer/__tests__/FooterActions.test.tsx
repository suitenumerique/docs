import type { UserMenuProps } from '@gouvfr-lasuite/ui-components';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { FooterActions } from '../components/FooterActions';

const mocks = vi.hoisted(() => ({
  config: {},
  user: null as { id: string } | null,
  userMenuProps: undefined as UserMenuProps | undefined,
}));

vi.mock('@gouvfr-lasuite/ui-components', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  UserMenu: (props: UserMenuProps) => {
    mocks.userMenuProps = props;
    return null;
  },
}));

vi.mock('@/core/config', () => ({
  useConfig: () => ({ data: mocks.config }),
}));

vi.mock('@/features/auth', () => ({
  ButtonLogin: () => null,
  EncryptionMenuButton: () => null,
  gotoLogout: vi.fn(),
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/components/Waffle', () => ({ Waffle: () => null }));
vi.mock('@/features/help', () => ({ HelpMenu: () => null }));
vi.mock('@/features/language/components/LanguagePicker', () => ({
  LanguagePicker: () => null,
}));

describe('FooterActions', () => {
  beforeEach(() => {
    mocks.config = {};
    mocks.user = { id: 'user-1' };
    mocks.userMenuProps = undefined;
  });

  test('links "Manage account" to ACCOUNT_SETTINGS_URL', () => {
    mocks.config = { ACCOUNT_SETTINGS_URL: 'https://accounts.test/' };

    render(<FooterActions />, { wrapper: AppWrapper });

    expect(mocks.userMenuProps?.settingsCTA).toBe('https://accounts.test/');
  });

  test('has no "Manage account" entry without ACCOUNT_SETTINGS_URL', () => {
    render(<FooterActions />, { wrapper: AppWrapper });

    expect(mocks.userMenuProps?.settingsCTA).toBeUndefined();
  });

  test('has no "Manage account" entry for a guest', () => {
    mocks.user = null;
    mocks.config = { ACCOUNT_SETTINGS_URL: 'https://accounts.test/' };

    render(<FooterActions />, { wrapper: AppWrapper });

    expect(mocks.userMenuProps?.settingsCTA).toBeUndefined();
  });
});
