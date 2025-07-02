import { Request, Response } from 'express';

import { hocuspocusServer } from '@/servers';
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
   */
  if (!userId) {
    hocuspocusServer.closeConnections(room);
  } else {
    /**
     * Close connections for the user in the room
     */
    hocuspocusServer.documents.forEach((doc) => {
      if (doc.name !== room) {
        return;
      }

      doc.getConnections().forEach((connection) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (connection.context.userId === userId) {
          connection.close();
        }
      });
    });
  }

  res.status(200).json({ message: 'Connections reset' });
};
