// Ambient bindings for the VaultClient SDK.
//
// The full method/type surface lives in ./client-sdk.d.ts, a VERBATIM copy of
// the encryption service's generated declaration (served at
// <encryption-domain>/public-assets/client.d.ts). Regenerate it with:
//   curl http://encryption.localhost:7200/public-assets/client.d.ts -o client-sdk.d.ts
// This file only re-exposes those types as the globals this codebase uses; never
// hand-edit signatures here — fix them at the source and re-vendor.
export {};

declare global {
  type VaultClient = import('./client-sdk').VaultClient;
  type VaultError = import('./client-sdk').VaultError;
  type VaultErrorCode = import('./client-sdk').VaultErrorCode;
  type RegisteredUser = import('./client-sdk').RegisteredUser;
  type RecipientLabel = import('./client-sdk').RecipientLabel;

  interface Window {
    EncryptionClient: typeof import('./client-sdk');
  }
}
