import { Request } from 'express';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import * as ws from 'ws';

import { fetchCurrentUser, fetchDocument } from '@/api/collaborationBackend';
import { hocuspocusServer } from '@/servers/hocuspocusServer';
import { logger } from '@/utils';
import { handleRelayServerConnection } from '@/servers/relayServer';

class WSProtocolError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'WSProtocolError';
  }
}

export const collaborationWSHandler = async (
  ws: ws.WebSocket,
  req: Request,
) => {
  // buffer messages that arrive while we do async checks below
  // note: without this, the client's first Yjs sync message can arrive before handleConnection registers its listener,
  // silently dropping it and causing the connection to hang forever
  const earlyMessages: ws.RawData[] = [];
  const earlyMessageHandler = (data: ws.RawData) => {
    earlyMessages.push(data);
  };

  ws.on('message', earlyMessageHandler);

  try {
    const roomId = new URL(req.url, 'ws://x').searchParams.get('room');

    if (!roomId) {
      throw new WSProtocolError(1007, 'room parameter must be provided');
    } else if (!uuidValidate(roomId) || uuidVersion(roomId) !== 4) {
      logger('Room name is not a valid uuid:', roomId);

      throw new WSProtocolError(1008, 'unauthorized');
    }

    const document = await fetchDocument(roomId, req.headers);

    if (!document.abilities.retrieve) {
      logger('onConnect: Unauthorized to retrieve this document', roomId);

      throw new WSProtocolError(1008, 'unauthorized');
    }

    const canEdit = document.abilities.update;

    const session = req.headers['cookie']
      ?.split('; ')
      .find((cookie) => cookie.startsWith('docs_sessionid='));
    let sessionKey: string | null = null;

    if (session) {
      sessionKey = session.split('=')[1];
    }

    logger('Connection established on room:', roomId, 'canEdit:', canEdit);

    /*
     * Getting the user to retrieve more information
     * but it's acceptable the request fails because non-encrypted files may be public
     */
    let userId: string | null = null;

    try {
      const user = await fetchCurrentUser(req.headers);

      userId = user.id;
    } catch {
      /* silent since optional */
    }

    // remove the early buffer before handing off to the real handler,
    // which will register its own message listener synchronously
    ws.off('message', earlyMessageHandler);

    // Since for "end-to-end encryption" the server cannot maintains its own state for the document
    // we use a different strategy with a relay server
    if (document.is_encrypted) {
      // mimick the Hocuspocus protocol to properly hide the frontend loader
      ws.send('system:authenticated');

      await handleRelayServerConnection(ws, roomId, userId);
    } else {
      hocuspocusServer.hocuspocus.handleConnection(ws, req, {
        roomId: roomId,
        readOnly: !canEdit,
        ...(sessionKey ? { sessionKey: sessionKey } : {}),
        ...(userId ? { userId: userId } : {}),
      });
    }

    // replay any messages the client sent while we were doing async checks
    for (const msg of earlyMessages) {
      ws.emit('message', msg);
    }
  } catch (error) {
    console.error('Failed to handle WebSocket connection:', error);

    if (error instanceof WSProtocolError) {
      ws.close(error.code, error.message);
    } else {
      ws.close(1011, 'internal error');
    }
  } finally {
    ws.off('message', earlyMessageHandler);
  }
};
