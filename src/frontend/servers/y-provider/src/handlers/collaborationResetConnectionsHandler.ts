import { Request, Response } from 'express';

import { hocuspocusServer } from '@/servers';
import { closeRelayConnections } from '@/servers/relayServer';
import { logger } from '@/utils';

type ResetConnectionsRequestQuery = {
  room?: string;
};

export const collaborationResetConnectionsHandler = (
  req: Request<object, object, object, ResetConnectionsRequestQuery>,
  res: Response,
) => {
  const room = req.query.room;
  const userId = req.headers['x-user-id'];

  logger('Resetting connections in room:', room, 'for user:', userId);

  if (!room) {
    res.status(400).json({ error: 'Room name not provided' });

    return;
  }

  /**
   * If no user ID is provided, close all connections in the room
   *
   * Below we avoid database call to check if the room if for encrypted server or not (could be switching to the other), so looking in both lists
   */
  if (!userId) {
    hocuspocusServer.hocuspocus.closeConnections(room);
    closeRelayConnections(room);
  } else {
    const targetUserId = Array.isArray(userId) ? userId[0] : userId;

    /**
     * Close connections for the user in the room (hocuspocus)
     */
    hocuspocusServer.hocuspocus.documents.forEach((doc) => {
      if (doc.name !== room) {
        return;
      }

      doc.getConnections().forEach((connection) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (connection.context.userId === targetUserId) {
          connection.close();
        }
      });
    });

    /**
     * Close connections for the user in the room (relay)
     */
    closeRelayConnections(room, targetUserId);
  }

  res.status(200).json({ message: 'Connections reset' });
};
