import { Request, Response } from 'express';

import { hocusPocusServer } from '@/servers/hocusPocusServer';
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

  const roomInfo = hocusPocusServer.documents.get(room);

  if (!roomInfo) {
    logger('Room not found:', room);
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const connections = roomInfo.getConnections();

  res.status(200).json({
    count: connections.length,
    exists: connections.some(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (connection) => connection.context.sessionKey === sessionKey,
    ),
  });
};
