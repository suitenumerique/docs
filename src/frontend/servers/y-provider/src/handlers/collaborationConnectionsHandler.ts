import { IncomingMessage } from 'http';

import { Request, Response } from 'express';
import * as ws from 'ws';
import * as Y from 'yjs';

import { hocusPocusServer } from '@/servers/hocusPocusServer';
import { base64ToYDoc, logger, toBase64 } from '@/utils';

export const collaborationWSHandler = (ws: ws.WebSocket, req: Request) => {
  logger('Incoming Origin:', req.headers['origin']);

  try {
    hocusPocusServer.handleConnection(ws, req);
  } catch (error) {
    console.error('Failed to handle WebSocket connection:', error);
    ws.close();
  }
};

type ResetConnectionsRequestQuery = {
  room?: string;
};

interface CollaborationHTTPHandlerRequest {
  yDoc64: string;
}

/**
 * Polling way of handling collaboration
 * @param req
 * @param res
 */
export const collaborationHTTPHandler = async (
  req: Request<
    object,
    object,
    CollaborationHTTPHandlerRequest,
    ResetConnectionsRequestQuery
  >,
  res: Response,
) => {
  const room = req.query.room;
  const yDoc64 = req.body.yDoc64;
  const canEdit = req.headers['x-can-edit'] === 'True';

  if (!room) {
    res.status(400).json({ error: 'Room name not provided' });
    return;
  }

  const syncYDoc64 = await syncDoc(room, yDoc64, canEdit, req);

  res.status(200).json({
    yDoc64: syncYDoc64,
  });
};

/**
 * Used only for polling:
 * - Sync the document with the latest changes.
 * - Create a new document if it does not exist.
 */
const syncDoc = async (
  room: string,
  yDoc64: string,
  canEdit: boolean,
  req: Partial<Pick<IncomingMessage, 'headers' | 'url'>>,
) => {
  let docExist = false;
  let syncYDoc = undefined;
  hocusPocusServer.documents.forEach((hpYDoc) => {
    if (hpYDoc.name !== room) {
      return;
    }

    docExist = true;

    const hpYDoc64 = toBase64(Y.encodeStateAsUpdate(hpYDoc));

    // If the document has not changed, return
    if (yDoc64 === hpYDoc64) {
      return;
    }

    // Sync the document with the latest changes
    syncYDoc = hpYDoc;

    if (!canEdit) {
      return;
    }

    // Merge the coming document with the latest changes (only if the user can edit)
    const ydoc = base64ToYDoc(yDoc64);
    syncYDoc = hpYDoc.merge(ydoc);

    logger('Polling Updated YDoc:', room);
  });

  /**
   * If the document does not exist, create a new one.
   * We create a new doc to allow multiple users without websocket
   * to collaborate with each others.
   * Only the first user will create the document, the others will
   * just sync with the latest changes.
   * Only users with edit permission can create a new document.
   */
  if (canEdit && !docExist) {
    const socketId = Math.random().toString(36).substring(7);
    const hpYDoc = await hocusPocusServer.createDocument(room, req, socketId, {
      readOnly: false,
      requiresAuthentication: false,
      isAuthenticated: true,
    });

    const ydoc = base64ToYDoc(yDoc64);
    syncYDoc = hpYDoc.merge(ydoc);
  }

  return syncYDoc && toBase64(Y.encodeStateAsUpdate(syncYDoc));
};
