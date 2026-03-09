import { userKeyPairAlgorithm } from './encryption';

export async function exportPrivateKeyAsJwk(
  privateKey: CryptoKey,
): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', privateKey);
}

export async function importPrivateKeyFromJwk(
  jwk: JsonWebKey,
): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: userKeyPairAlgorithm, hash: 'SHA-256' },
    true,
    ['decrypt'],
  );
}

export async function importPublicKeyFromJwk(
  jwk: JsonWebKey,
): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: userKeyPairAlgorithm, hash: 'SHA-256' },
    true,
    ['encrypt'],
  );
}

export async function exportPublicKeyAsBase64(
  publicKey: CryptoKey,
): Promise<string> {
  const rawPublicKey = await crypto.subtle.exportKey('spki', publicKey);

  return Buffer.from(new Uint8Array(rawPublicKey)).toString('base64');
}

// Derive a public JWK from a private JWK by removing private fields.
export function derivePublicJwkFromPrivate(privateJwk: JsonWebKey): JsonWebKey {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { d, p, q, dp, dq, qi, ...publicJwk } = privateJwk;

  return { ...publicJwk, key_ops: ['encrypt'] };
}

/**
 * Serialize a JWK to a compact passphrase-like string.
 * This is a base64url encoding of the full JWK JSON - not a mnemonic,
 * but compact enough to be stored in a password manager.
 */
export function jwkToPassphrase(jwk: JsonWebKey): string {
  const json = JSON.stringify(jwk);
  const base64 = Buffer.from(json).toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Deserialize a passphrase string back to a JWK.
 */
export function passphraseToJwk(passphrase: string): JsonWebKey {
  const base64 = passphrase.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(base64, 'base64').toString('utf-8');

  return JSON.parse(json) as JsonWebKey;
}
