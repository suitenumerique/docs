import { DBSchema, IDBPDatabase, deleteDB, openDB } from 'idb';

import { Doc, DocsResponse } from '@/docs/doc-management';

import { RequestData, RequestSerializer } from './RequestSerializer';

// eslint-disable-next-line import/order
import pkg from '@/../package.json';

export type DBRequest = {
  requestData: RequestData;
  key: string;
};

interface IDocsDB extends DBSchema {
  'doc-list': {
    key: string;
    value: DocsResponse;
  };
  'doc-item': {
    key: string;
    value: Doc;
  };
  'doc-mutation': {
    key: string;
    value: DBRequest;
  };
  'doc-version': {
    key: 'version';
    value: number;
  };
}

type TableName = 'doc-list' | 'doc-item' | 'doc-mutation';

/**
 * IndexDB version must be a integer
 * @returns
 */
const getCurrentVersion = () => {
  const [major, minor, patch] = pkg.version.split('.');
  return parseFloat(`${major}${minor}${patch}`);
};

/**
 * Static class for managing the Docs with IndexedDB.
 */
export class DocsDB {
  private static readonly DBNAME = 'api-docs-db';

  /**
   * IndexedDB instance.
   * @returns Promise<IDBPDatabase<DocsDB>>
   */
  public static open = async () => {
    let db: IDBPDatabase<IDocsDB>;

    try {
      db = await openDB<IDocsDB>(DocsDB.DBNAME, getCurrentVersion(), {
        upgrade(db) {
          if (!db.objectStoreNames.contains('doc-list')) {
            db.createObjectStore('doc-list');
          }
          if (!db.objectStoreNames.contains('doc-item')) {
            db.createObjectStore('doc-item');
          }
          if (!db.objectStoreNames.contains('doc-mutation')) {
            db.createObjectStore('doc-mutation');
          }
          if (!db.objectStoreNames.contains('doc-version')) {
            db.createObjectStore('doc-version');
          }
        },
      });
    } catch (error) {
      /**
       * If for any reason the current version is lower than the previous one,
       * we need to delete the database and create a new one.
       */
      console.error('SW: Failed to open IndexedDB', error);
      await deleteDB(DocsDB.DBNAME);

      db = await DocsDB.open();
    }

    return db;
  };

  public static deleteAll = async (tableName: TableName) => {
    const db = await DocsDB.open();
    const keys = await db.getAllKeys(tableName);

    for (const key of keys) {
      await db.delete(tableName, key);
    }

    db.close();
  };

  public static cleanupOutdatedVersion = async () => {
    const db = await DocsDB.open();
    const version = await db.get('doc-version', 'version');
    const currentVersion = getCurrentVersion();

    if (version != currentVersion) {
      console.debug('SW: Cleaning up outdated caches', version, currentVersion);

      await DocsDB.deleteAll('doc-item');
      await DocsDB.deleteAll('doc-list');
      await DocsDB.deleteAll('doc-mutation');
      await db.put('doc-version', currentVersion, 'version');
    }

    db.close();
  };

  /**
   * Save the response in the IndexedDB.
   */
  public static async cacheResponse(
    key: string,
    body: DocsResponse | Doc | DBRequest,
    tableName: TableName,
  ): Promise<void> {
    const db = await DocsDB.open();

    try {
      await db.put(tableName, body, key);
    } catch (error) {
      console.error(
        'SW: Failed to save response in IndexedDB',
        error,
        key,
        body,
      );
    }

    db.close();
  }

  public static hasSyncToDo = async () => {
    const db = await DocsDB.open();
    const requests = await db.getAll('doc-mutation');
    db.close();

    return requests.length > 0;
  };

  /**
   * Sync the queue with the server.
   */
  public static sync = async () => {
    const db = await DocsDB.open();
    const requests = await db.getAll('doc-mutation');

    for (const request of requests) {
      try {
        await fetch(new RequestSerializer(request.requestData).toRequest());
        await db.delete('doc-mutation', request.key);
      } catch (error) {
        console.error('SW: Replay failed for request', request, error);
        break;
      }
    }

    db.close();
  };
}
