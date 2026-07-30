/**
 * React context provider for the centralized encryption VaultClient SDK.
 *
 * The client SDK is loaded at runtime via a <script> tag from the vault domain
 * (data.encryption). Type declarations are provided by encryption-client.d.ts.
 *
 * This provider:
 * - Loads the client.js script from the vault URL
 * - Creates and initializes the VaultClient instance
 * - Sets auth context when the user logs in
 * - Tracks key state (hasKeys, publicKey)
 * - Provides the client to all downstream components
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useCunninghamTheme } from '@/cunningham';
import { useAuth } from '@/features/auth';

// Environment configuration
const VAULT_URL = process.env.NEXT_PUBLIC_VAULT_URL ?? 'http://localhost:7201';
const INTERFACE_URL =
  process.env.NEXT_PUBLIC_INTERFACE_URL ?? 'http://localhost:7202';

export interface VaultClientContextValue {
  /** The VaultClient instance, or null if not yet initialized */
  client: VaultClient | null;
  /** True once the vault iframe is ready AND auth context has been set */
  isReady: boolean;
  /** True while the vault is initializing */
  isLoading: boolean;
  /** Error message if initialization failed */
  error: string | null;
  /** Whether the current user has encryption keys on this device */
  hasKeys: boolean | null;
  /** The current user's public key, or null */
  publicKey: ArrayBuffer | null;
  /** Re-check key state (after onboarding, restore, etc.) */
  refreshKeyState: () => Promise<void>;
}

const VaultClientContext = createContext<VaultClientContextValue>({
  client: null,
  isReady: false,
  isLoading: true,
  error: null,
  hasKeys: null,
  publicKey: null,
  refreshKeyState: async () => {},
});

/** Load the encryption client SDK script from the vault domain */
function loadClientScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.EncryptionClient?.VaultClient) {
      resolve();

      return;
    }

    // Check if script tag already exists
    const existing = document.querySelector(
      `script[src="${VAULT_URL}/client.js"]`,
    );

    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load encryption client SDK')),
      );

      return;
    }

    const script = document.createElement('script');
    script.src = `${VAULT_URL}/client.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load encryption client SDK'));
    document.head.appendChild(script);
  });
}

export function VaultClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, authenticated } = useAuth();
  const { i18n } = useTranslation();
  const { theme: cunninghamTheme } = useCunninghamTheme();
  const clientRef = useRef<VaultClient | null>(null);
  const [clientInitialized, setClientInitialized] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasKeys, setHasKeys] = useState<boolean | null>(null);
  const [publicKey, setPublicKey] = useState<ArrayBuffer | null>(null);
  const initRef = useRef(false);

  // Load script + initialize VaultClient once
  useEffect(() => {
    if (initRef.current) {
      return;
    }
    initRef.current = true;

    let destroyed = false;

    async function init() {
      try {
        await loadClientScript();

        if (destroyed) {
          return;
        }

        const client = new window.EncryptionClient.VaultClient({
          vaultUrl: VAULT_URL,
          interfaceUrl: INTERFACE_URL,
          theme: cunninghamTheme,
          lang: i18n.language,
        });

        clientRef.current = client;

        client.on('onboarding:complete', () => {
          setHasKeys(true);
          client
            .getPublicKey()
            .then(({ publicKey: pk }) => setPublicKey(pk))
            .catch(() => {});
        });

        client.on('keys-changed', () => {
          client
            .hasKeys()
            .then(({ hasKeys: exists }) => {
              setHasKeys(exists);

              if (exists) {
                client
                  .getPublicKey()
                  .then(({ publicKey: pk }) => setPublicKey(pk))
                  .catch(() => {});
              }
            })
            .catch(() => {});
        });

        client.on('keys-destroyed', () => {
          setHasKeys(false);
          setPublicKey(null);
        });

        await client.init();

        if (destroyed) {
          client.destroy();
        } else {
          setClientInitialized(true);
        }
      } catch (err) {
        if (!destroyed) {
          setError((err as Error).message);
          setIsLoading(false);
        }
      }
    }

    void init();

    return () => {
      destroyed = true;

      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
    };
    // One-time init: theme and language are read from the first render only,
    // re-initializing the client on those changes is intentionally avoided.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set auth context whenever user changes or client finishes initializing
  useEffect(() => {
    const client = clientRef.current;

    if (
      !client ||
      !clientInitialized ||
      !authenticated ||
      !user?.id ||
      !user?.suite_user_id
    ) {
      return;
    }

    let cancelled = false;
    const suiteUserId = user.suite_user_id;

    async function setupAuth() {
      if (cancelled || !client) {
        return;
      }

      client.setAuthContext({
        suiteUserId,
      });

      setIsLoading(true);

      try {
        const { hasKeys: exists } = await client.hasKeys();
        setHasKeys(exists);

        if (exists) {
          const { publicKey: pk } = await client.getPublicKey();
          setPublicKey(pk);
        }

        setIsReady(true);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }

    void setupAuth();

    return () => {
      cancelled = true;
    };
  }, [clientInitialized, authenticated, user?.id, user?.suite_user_id]);

  const refreshKeyState = useCallback(async () => {
    const client = clientRef.current;

    if (!client) {
      return;
    }

    try {
      const { hasKeys: exists } = await client.hasKeys();
      setHasKeys(exists);

      if (exists) {
        const { publicKey: pk } = await client.getPublicKey();
        setPublicKey(pk);
      } else {
        setPublicKey(null);
      }
    } catch {
      // Vault not available
    }
  }, []);

  return (
    <VaultClientContext.Provider
      value={{
        client: isReady ? clientRef.current : null,
        isReady,
        isLoading,
        error,
        hasKeys,
        publicKey,
        refreshKeyState,
      }}
    >
      {children}
    </VaultClientContext.Provider>
  );
}

export const useVaultClient = (): VaultClientContextValue =>
  useContext(VaultClientContext);
