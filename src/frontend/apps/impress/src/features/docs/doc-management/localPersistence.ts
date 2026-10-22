import * as Y from '@y/y';
import { IDBPDatabase, openDB } from 'idb';

/**
 * Yjs 14-compatible storage using the same `updates` database as y-indexeddb.
 * The old provider cannot be used here because it imports its own Yjs 13 copy.
 */
export class LocalPersistence {
  private db?: IDBPDatabase;
  private pending: Uint8Array[] = [];
  private destroyed = false;
  private updateCount = 0;
  private write = Promise.resolve();
  private loading: Promise<void>;

  constructor(
    private name: string,
    private doc: Y.Doc,
    private onSynced: () => void,
  ) {
    doc.on('update', this.onUpdate);
    this.loading = this.load();
  }

  private onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || this.destroyed) {
      return;
    }
    if (!this.db) {
      this.pending.push(update);
      return;
    }
    this.store(update);
  };

  private store(update: Uint8Array) {
    const db = this.db;
    if (!db) {
      return;
    }
    this.write = this.write
      .then(async () => {
        await db.add('updates', update);
        if (++this.updateCount >= 500) {
          // Replace the update log with one snapshot. All previous writes have
          // finished before this one, so an interrupted compaction stays safe.
          const tx = db.transaction('updates', 'readwrite');
          const snapshotKey = await tx.store.add(
            Y.encodeStateAsUpdate(this.doc),
          );
          await tx.store.delete(IDBKeyRange.upperBound(snapshotKey, true));
          await tx.done;
          this.updateCount = 1;
        }
      })
      .catch((error) => {
        console.error('Failed to save the local copy of the document', error);
      });
  }

  private async load() {
    try {
      const db = await openDB(this.name, 1, {
        upgrade: (database) => {
          if (!database.objectStoreNames.contains('updates')) {
            database.createObjectStore('updates', { autoIncrement: true });
          }
          if (!database.objectStoreNames.contains('custom')) {
            database.createObjectStore('custom');
          }
        },
      });
      this.db = db;
      const updates: Uint8Array[] = await db.getAll('updates');
      this.updateCount = updates.length;
      Y.transact(
        this.doc,
        () => updates.forEach((update) => Y.applyUpdate(this.doc, update)),
        this,
      );
      this.pending.splice(0).forEach((update) => this.store(update));
      if (!this.destroyed) {
        this.onSynced();
      }
    } catch (error) {
      console.error('Failed to open the local copy of the document', error);
    }
  }

  async destroy() {
    this.destroyed = true;
    this.doc.off('update', this.onUpdate);
    await this.loading;
    await this.write;
    this.db?.close();
  }
}
