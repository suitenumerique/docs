export function encrypt(data: Uint8Array): Uint8Array {
  const key = 42;
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ key;
  }
  return encrypted;
}

export function decrypt(data: Uint8Array): Uint8Array {
  const key = 42;
  const decrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ key;
  }
  return decrypted;
}
