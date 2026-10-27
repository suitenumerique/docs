import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { ButtonEnableEncryption } from '../components/ButtonEnableEncryption';
import { EncryptionMenuButton } from '../components/EncryptionMenuButton';

type Listener = (payload?: unknown) => void;

const createVaultClient = () => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    on: vi.fn((event: string, listener: Listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)?.add(listener);
    }),
    off: vi.fn((event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener);
    }),
    emit: (event: string, payload?: unknown) => {
      listeners.get(event)?.forEach((listener) => listener(payload));
    },
    openSettings: vi.fn(),
    openOnboarding: vi.fn(),
    closeInterface: vi.fn(),
  };
};

const mocks = vi.hoisted(() => ({
  config: {},
  vault: {},
  refreshEncryption: vi.fn(),
  refreshKeyState: vi.fn(),
}));

vi.mock('@/core/config', () => ({
  useConfig: () => ({ data: mocks.config }),
}));

vi.mock('@/features/docs/doc-collaboration/vault', () => ({
  useVaultClient: () => mocks.vault,
}));

vi.mock('@/docs/doc-collaboration', () => ({
  useUserEncryption: () => ({ refreshEncryption: mocks.refreshEncryption }),
}));

vi.mock('../hooks', () => ({
  useAuth: () => ({ user: { id: 'user-1', suite_user_id: 'sub-1' } }),
}));

describe('EncryptionMenuButton', () => {
  let vaultClient: ReturnType<typeof createVaultClient>;

  beforeEach(() => {
    vaultClient = createVaultClient();
    mocks.refreshKeyState.mockReset().mockResolvedValue(undefined);
    mocks.config = {};
    mocks.vault = {
      isEnabled: true,
      client: vaultClient,
      hasKeys: false,
      error: null,
      refreshKeyState: mocks.refreshKeyState,
    };
  });

  test('shows nothing when ACCOUNT_SETTINGS_URL is set: encryption is managed in the account settings', () => {
    mocks.config = { ACCOUNT_SETTINGS_URL: 'https://accounts.test/' };

    render(<EncryptionMenuButton />, { wrapper: AppWrapper });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('opens the encryption home without a section when no URL is set, keys or not', async () => {
    render(<EncryptionMenuButton />, { wrapper: AppWrapper });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Encryption settings' }),
    );

    expect(vaultClient.openSettings).toHaveBeenCalledTimes(1);
    expect(vaultClient.openSettings).toHaveBeenCalledWith();
    expect(vaultClient.openOnboarding).not.toHaveBeenCalled();
  });

  test('renders nothing when the encryption feature is off', () => {
    mocks.vault = { ...mocks.vault, isEnabled: false };

    render(<EncryptionMenuButton />, { wrapper: AppWrapper });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ButtonEnableEncryption', () => {
  let vaultClient: ReturnType<typeof createVaultClient>;

  beforeEach(() => {
    vaultClient = createVaultClient();
    mocks.refreshEncryption.mockReset();
    mocks.refreshKeyState.mockReset().mockResolvedValue(undefined);
    mocks.vault = {
      isEnabled: true,
      client: vaultClient,
      hasKeys: false,
      error: null,
      refreshKeyState: mocks.refreshKeyState,
    };
  });

  test('opens the onboarding behind a loader and refreshes the state once it completes', async () => {
    const onEnabled = vi.fn();

    render(<ButtonEnableEncryption onEnabled={onEnabled} />, {
      wrapper: AppWrapper,
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Enable encryption' }),
    );

    expect(vaultClient.openOnboarding).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // The interface is on screen: the loader goes away.
    act(() => vaultClient.emit('interface:ready'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await act(async () => {
      vaultClient.emit('onboarding:complete', { publicKey: 'key' });
      await Promise.resolve();
    });

    expect(mocks.refreshKeyState).toHaveBeenCalled();
    expect(mocks.refreshEncryption).toHaveBeenCalled();
    expect(onEnabled).toHaveBeenCalledTimes(1);
  });

  test('is hidden when the encryption feature is off', () => {
    mocks.vault = { ...mocks.vault, isEnabled: false };

    render(<ButtonEnableEncryption />, { wrapper: AppWrapper });

    expect(
      screen.queryByRole('button', { name: 'Enable encryption' }),
    ).not.toBeInTheDocument();
  });
});
