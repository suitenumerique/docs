import { Request, Response } from 'express';

import { hocuspocusServer } from '@/servers';
import { logger } from '@/utils';
import { closeConn, getYDoc } from '@/servers/standard/utils';

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
    // hocuspocusServer.hocuspocus.closeConnections(room);

    const doc = getYDoc(room);

    if (doc) {
      doc.conns.forEach((_, conn) => closeConn(doc, conn));
    }
  } else {
    /**
     * Close connections for the user in the room
     */
    // hocuspocusServer.hocuspocus.documents.forEach((doc) => {
    //   if (doc.name !== room) {
    //     return;
    //   }
    //   doc.getConnections().forEach((connection) => {
    //     // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    //     if (connection.context.userId === userId) {
    //       connection.close();
    //     }
    //   });
    // });

    const doc = getYDoc(room);

    if (doc) {
      doc.conns.forEach((clientIds, conn) => {
        // TODO: with this current implementation there is no logic about user ID but only also "clientID"
        // ... it should be adapted first as for hocuspocus before having this metadata
        // closeConn(doc, conn)
      });
    }
  }

  res.status(200).json({ message: 'Connections reset' });
};
