export const userKeyPairAlgorithm = 'RSA-OAEP';
export const documentSymmetricKeyAlgorithm = 'AES-GCM';

export async function generateUserKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: userKeyPairAlgorithm,
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );
}

// generate a symmetric key for document encryption
export async function generateSymmetricKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: documentSymmetricKeyAlgorithm, length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// Encrypt a symmetric key with a user's public key
export async function encryptSymmetricKey(
  symmetricKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<ArrayBuffer> {
  const raw = await crypto.subtle.exportKey('raw', symmetricKey);

  // TODO:
  // TODO: should use something better than RSA-OAEP, but maybe WebCrypto is not enough (use downloaded library? "libsodium-wrappers" or so)
  // TODO:
  return await crypto.subtle.encrypt(
    { name: userKeyPairAlgorithm },
    publicKey,
    raw,
  );
}

// decrypt a symmetric key with the local private key
export async function decryptSymmetricKey(
  encryptedSymmetricKey: ArrayBuffer,
  privateKey: CryptoKey,
): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt(
    { name: userKeyPairAlgorithm },
    privateKey,
    encryptedSymmetricKey,
  );

  return await crypto.subtle.importKey(
    'raw',
    raw,
    { name: documentSymmetricKeyAlgorithm },
    true,
    ['encrypt', 'decrypt'],
  );
}

// encrypt content with a symmetric key
export async function encryptContent(
  content: Uint8Array<ArrayBuffer>,
  symmetricKey: CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: documentSymmetricKeyAlgorithm,
      iv,
    },
    symmetricKey,
    content,
  );

  // Prepend IV to ciphertext so the recipient can extract it for decryption
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), iv.length);

  return result;
}

// decrypt content with a symmetric key
export async function decryptContent(
  encryptedContent: Uint8Array<ArrayBuffer>,
  symmetricKey: CryptoKey,
): Promise<Uint8Array<ArrayBufferLike>> {
  const iv = encryptedContent.slice(0, 12);
  const ciphertext = encryptedContent.slice(12);
  const arrayBuffer = await crypto.subtle.decrypt(
    {
      name: documentSymmetricKeyAlgorithm,
      iv,
    },
    symmetricKey,
    ciphertext,
  );

  return new Uint8Array(arrayBuffer);
}

/**
 * Compute a SHA-256 fingerprint of a base64-encoded public key.
 * Returns a formatted hex string like "A1B2 C3D4 E5F6 7890".
 */
export async function computeKeyFingerprint(
  base64Key: string,
): Promise<string> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  const hash = await crypto.subtle.digest('SHA-256', raw);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hex
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim()
    .toUpperCase();
}

// prepare encrypted symmetric keys for all users with access to a document
export async function prepareEncryptedSymmetricKeysForUsers(
  symmetricKey: CryptoKey,
  accessesPublicKeysPerUser: Record<string, ArrayBuffer>,
): Promise<Record<string, ArrayBuffer>> {
  const result: Record<string, ArrayBuffer> = {};

  // encrypt the symmetric key for each user's public key
  for (const [userId, publicKey] of Object.entries(accessesPublicKeysPerUser)) {
    const usablePublicKey = await crypto.subtle.importKey(
      'spki',
      publicKey,
      { name: userKeyPairAlgorithm, hash: 'SHA-256' },
      true,
      ['encrypt'],
    );

    result[userId] = await encryptSymmetricKey(symmetricKey, usablePublicKey);
  }

  return result;
}
