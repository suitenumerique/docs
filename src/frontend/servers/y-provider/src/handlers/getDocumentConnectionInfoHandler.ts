import { Request, Response } from 'express';

import { hocuspocusServer } from '@/servers';
import { getRelayRoom } from '@/servers/relayServer';
import { logger } from '@/utils';

type getDocumentConnectionInfoRequestQuery = {
  room?: string;
  sessionKey?: string;
};

export const getDocumentConnectionInfoHandler = (
  req: Request<object, object, object, getDocumentConnectionInfoRequestQuery>,
  res: Response,
) => {
  const room = req.query.room;
  const sessionKey = req.query.sessionKey;

  if (!room) {
    res.status(400).json({ error: 'Room name not provided' });

    return;
  }

  if (!req.query.sessionKey) {
    res.status(400).json({ error: 'Session key not provided' });

    return;
  }

  logger('Getting document connection info for room:', room);

  // we avoid database call since a document could be being encrypted or not, so looking in both lists
  // so check hocuspocus first (non-encrypted documents)
  const hocuspocusRoom = hocuspocusServer.hocuspocus.documents.get(room);

  if (hocuspocusRoom) {
    const connections = hocuspocusRoom
      .getConnections()
      .filter((connection) => connection.readOnly === false);

    res.status(200).json({
      count: connections.length,
      exists: connections.some(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (connection) => connection.context.sessionKey === sessionKey,
      ),
    });

    return;
  }

  const relayRoom = getRelayRoom(room);

  if (relayRoom) {
    // the relay server is a blind passthrough, there is no readOnly distinction
    // or session key tracking, so we report all connections and cannot confirm session existence
    res.status(200).json({
      count: relayRoom.size,
      exists: false,
    });

    return;
  }

  logger('Room not found:', room);

  res.status(404).json({ error: 'Room not found' });
};
