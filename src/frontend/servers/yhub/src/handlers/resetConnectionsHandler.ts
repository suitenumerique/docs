import { Request, Response } from 'express';

import { RedisClient } from '@/registry/connectionRegistry';
import { publishKick } from '@/registry/kickChannel';
import { logger } from '@/utils';

/**
 * Called by Django when permissions change. The kick is published on Redis so
 * every gateway instance closes its matching local sockets (code 4000); the
 * clients then reconnect and re-run the gateway auth with their new rights.
 */
export const createResetConnectionsHandler =
  (redis: RedisClient) => async (req: Request, res: Response) => {
    const room = req.query.room as string | undefined;
    const userId = req.headers['x-user-id'] as string | undefined;

    if (!room) {
      res.status(400).json({ error: 'Room name not provided' });
      return;
    }

    try {
      await publishKick(redis, { room, ...(userId && { userId }) });
      res.status(200).json({ message: 'Connections reset' });
    } catch (error) {
      logger('reset-connections error', error);
      res.status(500).json({ error: 'Failed to reset connections' });
    }
  };
