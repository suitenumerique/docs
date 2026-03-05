import { createContext, useContext } from 'react';

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
}

const UserEncryptionContext = createContext<UserEncryptionContextValue>({
  encryptionLoading: true,
  encryptionSettings: null,
  encryptionError: null,
});

export const UserEncryptionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useAuth();
  const value = useEncryption(user?.id);

  return (
    <UserEncryptionContext.Provider value={value}>
      {children}
    </UserEncryptionContext.Provider>
  );
};

export const useUserEncryption = (): UserEncryptionContextValue =>
  useContext(UserEncryptionContext);
