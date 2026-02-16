const userKeyPairAlgorithm = 'RSA-OAEP';
const documentSymmetricKeyAlgorithm = 'AES-GCM';

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
  const arrayBuffer = await crypto.subtle.encrypt(
    {
      name: documentSymmetricKeyAlgorithm,
    },
    symmetricKey,
    content,
  );

  return new Uint8Array(arrayBuffer);
}

// decrypt content with a symmetric key
export async function decryptContent(
  encryptedContent: Uint8Array<ArrayBuffer>,
  symmetricKey: CryptoKey,
): Promise<Uint8Array<ArrayBufferLike>> {
  const arrayBuffer = await crypto.subtle.decrypt(
    {
      name: documentSymmetricKeyAlgorithm,
    },
    symmetricKey,
    encryptedContent,
  );

  return new Uint8Array(arrayBuffer);
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
      'raw',
      publicKey,
      { name: userKeyPairAlgorithm },
      true,
      ['encrypt', 'decrypt'],
    );

    result[userId] = await encryptSymmetricKey(symmetricKey, usablePublicKey);
  }

  return result;
}
