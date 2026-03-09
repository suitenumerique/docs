import { createContext, useCallback, useContext, useState } from 'react';

import { useAuth } from '@/features/auth';

import { EncryptionError, useEncryption } from './hook/useEncryption';

interface UserEncryptionContextValue {
  encryptionLoading: boolean;
  encryptionSettings: {
    userId: string;
    userPrivateKey: CryptoKey;
    userPublicKey: CryptoKey;
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const encryptionValue = useEncryption(user?.id, refreshTrigger);

  const refreshEncryption = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <UserEncryptionContext.Provider
      value={{ ...encryptionValue, refreshEncryption }}
    >
      {children}
    </UserEncryptionContext.Provider>
  );
};

export const useUserEncryption = (): UserEncryptionContextValue =>
  useContext(UserEncryptionContext);
