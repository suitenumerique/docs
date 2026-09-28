/**
 * User encryption context provider.
 *
 * MIGRATION NOTE: This provider now bridges between the VaultClient SDK
 * and the existing encryption context interface used by downstream components.
 * The vault handles all key storage and crypto operations — we no longer
 * expose raw CryptoKey objects. Instead, `encryptionSettings` signals that
 * encryption is available, and components use the VaultClient directly for
 * encrypt/decrypt operations.
 */
import { createContext, useCallback, useContext, useState } from 'react';

import { useAuth } from '@/features/auth';

import { useVaultClient } from './vault';

export type EncryptionError =
  'missing_private_key' | 'missing_public_key' | null;

interface UserEncryptionContextValue {
  encryptionLoading: boolean;
  /**
   * Non-null when the user has encryption keys available.
   * NOTE: userPrivateKey and userPublicKey are no longer raw CryptoKey objects.
   * They are kept as null placeholders for type compatibility. Use the VaultClient
   * directly for all crypto operations.
   */
  encryptionSettings: {
    userId: string;
    userPrivateKey: null;
    userPublicKey: null;
  } | null;
  encryptionError: EncryptionError;
  refreshEncryption: () => void;
}

const UserEncryptionContext = createContext<UserEncryptionContextValue>({
  encryptionLoading: true,
  encryptionSettings: null,
  encryptionError: null,
  refreshEncryption: () => {},
});

export const UserEncryptionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useAuth();
  const { isReady, isLoading, hasKeys, error, refreshKeyState } =
    useVaultClient();
  const [, setRefreshTrigger] = useState(0);

  const refreshEncryption = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
    void refreshKeyState();
  }, [refreshKeyState]);

  // Derive the legacy context value from the VaultClient state
  let encryptionSettings: UserEncryptionContextValue['encryptionSettings'] =
    null;
  let encryptionError: EncryptionError = null;

  if (isReady && user?.suite_user_id) {
    if (hasKeys) {
      encryptionSettings = {
        userId: user.suite_user_id,
        userPrivateKey: null, // Keys are in the vault — use VaultClient for crypto
        userPublicKey: null,
      };
    } else {
      encryptionError = 'missing_private_key';
    }
  } else if (!isLoading && error) {
    encryptionError = 'missing_private_key';
  }

  return (
    <UserEncryptionContext.Provider
      value={{
        encryptionLoading: isLoading,
        encryptionSettings,
        encryptionError,
        refreshEncryption,
      }}
    >
      {children}
    </UserEncryptionContext.Provider>
  );
};

export const useUserEncryption = (): UserEncryptionContextValue =>
  useContext(UserEncryptionContext);
