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
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
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
    this._hpDocument = await hocusPocusServer.loadingDocuments.get(room);

    if (this._hpDocument) {
      return this._hpDocument;
    }

    this._hpDocument = hocusPocusServer.documents.get(room);

    if (this._hpDocument || (!this._hpDocument && !canEdit)) {
      return this._hpDocument;
    }

    /**
     * createDocument is used to create a new document if it does not exist.
     * If the document exists, it will return the existing document.
     */
    console.log('Create New');
    this._hpDocument = await hocusPocusServer.createDocument(
      room,
      req,
      uuid(),
      {
        readOnly: false,
        requiresAuthentication: false,
        isAuthenticated: false,
      },
    );

    return this._hpDocument;
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
   * Send messages to other clients
   */
  public sendMessages(message64: string) {
    console.log('Polling Updated 1234');
    const hpDoc = this.getHpDocument();

    hpDoc.getConnections().forEach((connection) => {
      connection.handleMessage(Buffer.from(message64, 'base64'));
    });

    logger('Polling Updated YDoc', hpDoc.name);
  }

  public receiveMessages(res: Response) {
    const hpDoc = this.getHpDocument();

    const updateFn = (
      update: Uint8Array,
      _origin: string,
      updatedDoc: Y.Doc,
      _transaction: Y.Transaction,
    ) => {
      console.log('Doc Update V2');

      res.write(
        `data: ${JSON.stringify({
          time: new Date(),
          updatedDoc64: toBase64(update),
          stateFingerprint: this.getStateFingerprint(updatedDoc),
        })}\n\n`,
      );
    };

    const destroyFn = (updatedDoc: Y.Doc) => {
      console.log('Doc Destroy V2');
      res.write(
        `data: ${JSON.stringify({
          time: new Date(),
          updatedDoc64: undefined,
          stateFingerprint: this.getStateFingerprint(updatedDoc),
        })}\n\n`,
      );

      hpDoc.off('destroy', destroyFn);
      hpDoc.off('update', updateFn);

      res.end();
    };

    hpDoc.off('update', updateFn);
    hpDoc.off('destroy', destroyFn);
    hpDoc.on('update', updateFn);
    hpDoc.on('destroy', destroyFn);

    this.req.on('close', () => {
      console.log('Connection SSE closed');
      hpDoc.off('update', updateFn);
      hpDoc.off('destroy', destroyFn);
    });
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
