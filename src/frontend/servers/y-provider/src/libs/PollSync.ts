/* eslint-disable @typescript-eslint/no-unused-vars */
import crypto from 'crypto';

import {
  AwarenessUpdate,
  Connection,
  Debugger,
  Document,
  Hocuspocus,
  IncomingMessage,
  MessageReceiver,
} from '@hocuspocus/server';
import { Request } from 'express';
import WebSocket from 'ws';
import * as Y from 'yjs';

import { promiseDone } from '@/helpers';
import { base64ToYDoc, logger, toBase64 } from '@/utils';

type AwarenessState = Record<string, Record<string, unknown>>;

export type PollSyncRequestQuery = {
  room?: string;
};

export type PollSyncRequest<T> = Request<
  object,
  object,
  T,
  PollSyncRequestQuery
>;

export class PollSync<T> {
  public readonly canEdit: boolean;
  public readonly req: PollSyncRequest<T>;
  public readonly room: string;
  private _hpDocument?: Document;

  constructor(req: PollSyncRequest<T>, room: string, canEdit: boolean) {
    this.room = room;
    this.canEdit = canEdit;
    this.req = req;
  }

  public get hpDocument() {
    return this._hpDocument;
  }

  public async initHocuspocusDocument(hocusPocusServer: Hocuspocus) {
    const { req, room, canEdit } = this;
    this._hpDocument = hocusPocusServer.documents.get(room);

    if (!this._hpDocument && !canEdit) {
      return;
    }

    if (!this._hpDocument) {
      /**
       * createDocument is used to create a new document if it does not exist.
       * If the document exists, it will return the existing document.
       */
      const socketId = Math.random().toString(36).substring(7);
      console.log('Create New');
      this._hpDocument = await hocusPocusServer.createDocument(
        room,
        req,
        socketId,
        {
          readOnly: false,
          requiresAuthentication: false,
          isAuthenticated: false,
        },
      );
    }

    return this._hpDocument;
  }

  public async getUpdatedDoc(): Promise<{
    updatedDoc64: string;
    stateFingerprint: string;
  }> {
    const hpDoc = this.getHpDocument();
    const { promise, done } = promiseDone<{
      updatedDoc64: string;
      stateFingerprint: string;
    }>();

    console.log('Get Updated V3 Doc');

    const updateFn = (
      update: Uint8Array,
      _origin: string,
      _updatedDoc: Y.Doc,
      _transaction: Y.Transaction,
    ) => {
      console.log('Doc Update V2');

      done({
        updatedDoc64: toBase64(update),
        stateFingerprint: this.getStateFingerprint(_updatedDoc),
      });

      hpDoc.off('update', updateFn);
    };

    hpDoc.off('update', updateFn);
    hpDoc.on('update', updateFn);

    return promise;
  }

  /**
   * Create a hash SHA-256 of the state vector of the document.
   * Usefull to compare the state of the document.
   * @param doc
   * @returns
   */
  public sync(localDoc64: string): string | undefined {
    const hpDoc = this.getHpDocument();

    // Sync the document with the latest changes
    let syncYDoc = hpDoc;

    // Merge the coming document with the latest changes (only if the user can edit)
    if (this.canEdit) {
      const localDoc = base64ToYDoc(localDoc64);
      syncYDoc = hpDoc.merge(localDoc);
    }

    return toBase64(Y.encodeStateAsUpdate(syncYDoc));
  }

  /**
   * Create a hash SHA-256 of the state vector of the document.
   * Usefull to compare the state of the document.
   * @param doc
   * @returns
   */
  private getStateFingerprint(doc: Y.Doc): string {
    const stateVector = Y.encodeStateVector(doc);
    return crypto.createHash('sha256').update(stateVector).digest('base64'); // or 'hex'
  }

  /**
   * - Dispatch new messages to clients
   */
  public messageHandler(
    message64: string,
    connections?: Map<
      WebSocket,
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clients: Set<any>;
        connection: Connection;
      }
    >,
  ) {
    console.log('Polling Updated message64', message64);

    const hpDoc = this.getHpDocument();
    const messageBuffer = Buffer.from(message64, 'base64');
    const message = new IncomingMessage(messageBuffer);
    const room = message.readVarString();

    console.log('Which room', room);
    if (hpDoc.name !== room) {
      logger('Polling update message64 problem', hpDoc.name);
      return;
    }

    const mr = new MessageReceiver(message, new Debugger());

    if (connections) {
      try {
        connections.forEach((connection) => {
          mr.apply(hpDoc, connection.connection);
        });
      } catch (e) {
        console.log('Error in messageHandler', e);
      }
    }

    logger('Polling Updated YDoc', hpDoc.name);
  }

  private getHpDocument() {
    if (!this.hpDocument) {
      throw new Error('HocuPocus document not initialized');
    }

    return this.hpDocument;
  }

  public async getAwarenessStates(): Promise<AwarenessState | undefined> {
    const hpDoc = this.getHpDocument();
    const { promise, done } = promiseDone<AwarenessState | undefined>();

    const updateFn = (update: AwarenessUpdate) => {
      console.log('Awareness Update', update);

      done(
        hpDoc.hasAwarenessStates()
          ? Object.fromEntries(hpDoc.awareness.getStates())
          : undefined,
      );

      hpDoc.awareness.off('update', updateFn);
    };

    hpDoc.awareness.off('update', updateFn);
    hpDoc.awareness.on('update', updateFn);

    return promise;
  }
}
