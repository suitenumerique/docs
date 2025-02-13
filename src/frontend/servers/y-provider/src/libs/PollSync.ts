/* eslint-disable @typescript-eslint/no-unused-vars */
import crypto from 'crypto';

import {
  AwarenessUpdate,
  Document,
  Hocuspocus,
  IncomingMessage,
  MessageType,
  OutgoingMessage,
} from '@hocuspocus/server';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { applyAwarenessUpdate } from 'y-protocols/awareness.js';
import { readSyncMessage } from 'y-protocols/sync';
import * as Y from 'yjs';

import { base64ToYDoc, logger, toBase64 } from '@/utils';

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
   * Sync the document with the latest changes
   *
   * @param localDoc64
   * @returns
   */
  public sync(localDoc64: string): string | undefined {
    const hpDoc = this.getHpDocument();
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
  protected getStateFingerprint(doc: Y.Doc): string {
    const stateVector = Y.encodeStateVector(doc);
    return crypto.createHash('sha256').update(stateVector).digest('base64'); // or 'hex'
  }

  /**
   * Send messages to other clients
   */
  public sendClientsMessages(message64: string) {
    const hpDoc = this.getHpDocument();
    const messageBuffer = Buffer.from(message64, 'base64');
    const message = new IncomingMessage(messageBuffer);
    const room = message.readVarString();

    if (hpDoc.name !== room) {
      logger('Send messages problem, room different', room, hpDoc.name);
      return;
    }

    // We write the sync to the current doc - it will propagate to others by itself
    const type = message.readVarUint() as MessageType;
    if (type === MessageType.Sync) {
      message.writeVarUint(MessageType.Sync);
      readSyncMessage(message.decoder, message.encoder, hpDoc, null);
    } else if (type === MessageType.Awareness) {
      const awarenessUpdate = message.readVarUint8Array();
      applyAwarenessUpdate(
        hpDoc.awareness,
        awarenessUpdate,
        hpDoc.awareness.clientID,
      );
    } else {
      hpDoc.getConnections().forEach((connection) => {
        connection.handleMessage(messageBuffer);
      });
    }
  }

  /**
   * Pull messages from other clients
   *
   * We listen 2 kind of messages:
   *  - Document updates (change in the document)
   *  - Awareness messages (cursor, selection, etc.)
   *
   * @param res
   */
  public pullClientsMessages(res: Response) {
    const hpDoc = this.getHpDocument();
    hpDoc.addDirectConnection();

    const updateMessagesFn = (
      update: Uint8Array,
      _origin: string,
      updatedDoc: Y.Doc,
      _transaction: Y.Transaction,
    ) => {
      res.write(
        `data: ${JSON.stringify({
          time: new Date(),
          updatedDoc64: toBase64(update),
          stateFingerprint: this.getStateFingerprint(updatedDoc),
        })}\n\n`,
      );
    };

    const destroyFn = (updatedDoc: Y.Doc) => {
      res.write(
        `data: ${JSON.stringify({
          time: new Date(),
          updatedDoc64: undefined,
          stateFingerprint: this.getStateFingerprint(updatedDoc),
        })}\n\n`,
      );

      hpDoc.off('destroy', destroyFn);
      hpDoc.off('update', updateMessagesFn);

      // Close the connection
      res.end();
    };

    const updateAwarenessFn = ({
      added,
      updated,
      removed,
    }: AwarenessUpdate) => {
      const changedClients = added.concat(updated, removed);
      const awarenessMessage = new OutgoingMessage(
        this.room,
      ).createAwarenessUpdateMessage(hpDoc.awareness, changedClients);

      res.write(
        `data: ${JSON.stringify({
          time: new Date(),
          awareness64: toBase64(awarenessMessage.toUint8Array()),
          stateFingerprint: this.getStateFingerprint(hpDoc),
        })}\n\n`,
      );
    };

    hpDoc.awareness.off('update', updateAwarenessFn);
    hpDoc.awareness.on('update', updateAwarenessFn);
    hpDoc.off('update', updateMessagesFn);
    hpDoc.off('destroy', destroyFn);
    hpDoc.on('update', updateMessagesFn);
    hpDoc.on('destroy', destroyFn);

    this.req.on('close', () => {
      hpDoc.off('update', updateMessagesFn);
      hpDoc.off('destroy', destroyFn);
      hpDoc.awareness.off('update', updateAwarenessFn);
      hpDoc.removeDirectConnection();
    });
  }

  protected getHpDocument() {
    if (!this.hpDocument) {
      throw new Error('HocusPocus document not initialized');
    }

    return this.hpDocument;
  }
}
