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

import { useConfig } from '@/core/config';
import { useCunninghamTheme } from '@/cunningham';
import { useAuth } from '@/features/auth';

export interface VaultClientContextValue {
  /**
   * Runtime feature flag (ENCRYPTION_FEATURE_ENABLED on the backend). When
   * false the SDK script is never loaded, `client` stays null and every
   * encryption entry point must stay hidden.
   */
  isEnabled: boolean;
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
  isEnabled: false,
  client: null,
  isReady: false,
  isLoading: true,
  error: null,
  hasKeys: null,
  publicKey: null,
  refreshKeyState: async () => {},
});

/** Load the encryption client SDK script from the vault domain */
function loadClientScript(vaultUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.EncryptionClient?.VaultClient) {
      resolve();

      return;
    }

    // Check if script tag already exists
    const existing = document.querySelector(
      `script[src="${vaultUrl}/client.js"]`,
    );

    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load encryption client SDK')),
      );

      return;
    }

    const script = document.createElement('script');
    script.src = `${vaultUrl}/client.js`;
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
  const { user, authenticated, isLoading: authLoading } = useAuth();
  const { data: config } = useConfig();
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

  // The flag and both URLs come from the backend config so one frontend build
  // serves every environment; `isEnabled` stays false until the config is
  // known, which keeps `isLoading` true rather than flashing a disabled state.
  const configLoaded = config !== undefined;
  const vaultUrl = config?.ENCRYPTION_VAULT_URL ?? null;
  const interfaceUrl = config?.ENCRYPTION_INTERFACE_URL ?? null;
  const isEnabled =
    config?.ENCRYPTION_FEATURE_ENABLED === true && !!vaultUrl && !!interfaceUrl;

  // Load script + initialize VaultClient once, and only when the feature is on
  useEffect(() => {
    if (!configLoaded || initRef.current) {
      return;
    }

    if (!isEnabled || !vaultUrl || !interfaceUrl) {
      setIsLoading(false);

      return;
    }

    initRef.current = true;

    const resolvedVaultUrl: string = vaultUrl;
    const resolvedInterfaceUrl: string = interfaceUrl;
    let destroyed = false;

    async function init() {
      try {
        await loadClientScript(resolvedVaultUrl);

        if (destroyed) {
          return;
        }

        const client = new window.EncryptionClient.VaultClient({
          vaultUrl: resolvedVaultUrl,
          interfaceUrl: resolvedInterfaceUrl,
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
  }, [configLoaded, isEnabled, vaultUrl, interfaceUrl]);

  // Set auth context whenever user changes or client finishes initializing
  useEffect(() => {
    const client = clientRef.current;

    if (!client || !clientInitialized) {
      return;
    }

    if (!authenticated || !user?.id || !user?.suite_user_id) {
      // Anonymous visitor (public doc) or a user the vault cannot identify:
      // there is nothing to set up, so stop reporting "loading" or every
      // document page would wait forever.
      if (!authLoading) {
        setIsLoading(false);
      }

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
  }, [
    clientInitialized,
    authenticated,
    authLoading,
    user?.id,
    user?.suite_user_id,
  ]);

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
        isEnabled,
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
