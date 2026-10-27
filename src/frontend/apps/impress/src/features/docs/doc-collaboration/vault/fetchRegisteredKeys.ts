export async function fetchRegisteredKeys(
  client: VaultClient,
  userIds: string[],
): Promise<{
  publicKeys: Record<string, ArrayBuffer>;
  versions: Record<string, number>;
}> {
  const users = await client.fetchPublicKeys(userIds);
  const publicKeys: Record<string, ArrayBuffer> = {};
  const versions: Record<string, number> = {};

  for (const [id, u] of Object.entries(users)) {
    if (u.encryptionPublicKey) {
      publicKeys[id] = u.encryptionPublicKey;
      versions[id] = u.version;
    }
  }

  return { publicKeys, versions };
}
