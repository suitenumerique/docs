// Re-export types from encryption-client.d.ts for global availability
export {};

declare global {
  interface VaultClient {
    init(): Promise<void>;
    destroy(): void;
    setTheme(theme: string): void;
    setAuthContext(context: { suiteUserId: string }): void;
    hasKeys(): Promise<{ hasKeys: boolean }>;
    getPublicKey(): Promise<{ publicKey: ArrayBuffer }>;
    encryptWithoutKey(data: ArrayBuffer, userPublicKeys: Record<string, ArrayBuffer>): Promise<{ encryptedContent: ArrayBuffer; encryptedKeys: Record<string, ArrayBuffer> }>;
    encryptWithKey(data: ArrayBuffer, encryptedSymmetricKey: ArrayBuffer): Promise<{ encryptedData: ArrayBuffer }>;
    decryptWithKey(encryptedData: ArrayBuffer, encryptedSymmetricKey: ArrayBuffer): Promise<{ data: ArrayBuffer }>;
    shareKeys(encryptedSymmetricKey: ArrayBuffer, userPublicKeys: Record<string, ArrayBuffer>): Promise<{ encryptedKeys: Record<string, ArrayBuffer> }>;
    computeKeyFingerprint(publicKey: ArrayBuffer): Promise<string>;
    formatFingerprint(fingerprint: string): string;
    fetchPublicKeys(userIds: string[]): Promise<{ publicKeys: Record<string, ArrayBuffer> }>;
    checkFingerprints(userFingerprints: Record<string, string>, currentUserId?: string): Promise<{ results: Array<{ userId: string; knownFingerprint: string | null; providedFingerprint: string; status: 'trusted' | 'refused' | 'unknown' }> }>;
    acceptFingerprint(userId: string, fingerprint: string): Promise<void>;
    refuseFingerprint(userId: string, fingerprint: string): Promise<void>;
    getKnownFingerprints(): Promise<{ fingerprints: Record<string, { fingerprint: string; status: 'trusted' | 'refused' | 'unknown' }> }>;
    openOnboarding(container: HTMLElement): void;
    openBackup(container: HTMLElement): void;
    openRestore(container: HTMLElement): void;
    openDeviceTransfer(container: HTMLElement): void;
    openSettings(container: HTMLElement): void;
    closeInterface(): void;
    on<K extends string>(event: K, listener: (data: any) => void): void;
    off<K extends string>(event: K, listener: (data: any) => void): void;
  }

  interface Window {
    EncryptionClient: {
      VaultClient: new (options: {
        vaultUrl: string;
        interfaceUrl: string;
        timeout?: number;
        theme?: string;
        lang?: string;
      }) => VaultClient;
    };
  }
}
