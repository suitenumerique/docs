import { Doc } from '@/features/docs/doc-management/types';

export async function generateUserKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );
}

// Generate a symmetric key for document encryption
export async function generateSymmetricKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
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
  return await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw);
}

// Decrypt a symmetric key with the local private key
export async function decryptSymmetricKey(
  encryptedSymmetricKey: ArrayBuffer,
  privateKey: CryptoKey,
): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedSymmetricKey,
  );

  return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

// Encrypt content with a symmetric key
export async function encryptContent(
  content: Uint8Array<ArrayBuffer>,
  symmetricKey: CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> {
  const arrayBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
    },
    symmetricKey,
    content,
  );

  return new Uint8Array(arrayBuffer);
}

// Decrypt content with a symmetric key
export async function decryptContent(
  encryptedContent: Uint8Array<ArrayBuffer>,
  symmetricKey: CryptoKey,
): Promise<Uint8Array<ArrayBufferLike>> {
  const arrayBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
    },
    symmetricKey,
    encryptedContent,
  );

  return new Uint8Array(arrayBuffer);
}

/**
 * Get the symmetric key for a document
 * If the document is encrypted and we have access, decrypt the symmetric key
 */
export function getDocumentSymmetricKey(doc: Doc): string | null {
  if (!doc.is_encrypted) {
    return null;
  }

  // For now, use the hardcoded private key to decrypt
  // In production, this should use the user's actual private key
  if (doc.accesses_public_keys_per_user) {
    const currentUserId = 'current-user-id'; // TODO: Get actual current user ID
    const encryptedSymmetricKey =
      doc.accesses_public_keys_per_user[currentUserId];

    if (encryptedSymmetricKey) {
      return decryptSymmetricKey(encryptedSymmetricKey);
    }
  }

  return null;
}

/**
 * Prepare encrypted symmetric keys for all users with access to a document
 */
export function prepareEncryptedSymmetricKeysForUsers(
  symmetricKey: string,
  accessesPublicKeysPerUser?: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};

  if (!accessesPublicKeysPerUser) {
    return result;
  }

  // Encrypt the symmetric key for each user's public key
  for (const [userId, publicKey] of Object.entries(accessesPublicKeysPerUser)) {
    result[userId] = encryptSymmetricKeyWithPublicKey(symmetricKey, publicKey);
  }

  return result;
}
