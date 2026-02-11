import { IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'encryption';
const DB_VERSION = 1;

// Store names
export const STORE_PRIVATE_KEY = 'privateKey';
export const STORE_PUBLIC_KEY = 'publicKey';
export const STORE_KNOWN_PUBLIC_KEYS = 'knownPublicKeys';

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Opens (or reuses) the encryption IndexedDB with all required object stores.
 * Uses a singleton promise so the upgrade callback only runs once.
 */
export function getEncryptionDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_PRIVATE_KEY)) {
          db.createObjectStore(STORE_PRIVATE_KEY);
        }
        if (!db.objectStoreNames.contains(STORE_PUBLIC_KEY)) {
          db.createObjectStore(STORE_PUBLIC_KEY);
        }
        if (!db.objectStoreNames.contains(STORE_KNOWN_PUBLIC_KEYS)) {
          db.createObjectStore(STORE_KNOWN_PUBLIC_KEYS);
        }
      },
    });
  }

  return dbPromise;
}
