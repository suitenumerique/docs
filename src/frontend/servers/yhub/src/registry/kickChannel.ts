import { YHUB_REDIS_PREFIX } from '@/env';
import { logger } from '@/utils';

import { RedisClient } from './connectionRegistry';

export interface KickMessage {
  room: string;
  userId?: string;
}

/** Close code received by kicked clients; they reconnect and re-auth. */
export const KICK_CLOSE_CODE = 4000;

export const kickChannel = () => `${YHUB_REDIS_PREFIX}:gw:kick`;

export const publishKick = async (redis: RedisClient, message: KickMessage) => {
  await redis.publish(kickChannel(), JSON.stringify(message));
};

/**
 * Every gateway instance subscribes (on a dedicated subscriber connection)
 * and closes its matching local sockets — that is what makes reset-connections
 * correct with multiple gateway replicas.
 */
export const subscribeKicks = async (
  subscriber: RedisClient,
  onKick: (message: KickMessage) => void,
) => {
  await subscriber.subscribe(kickChannel(), (raw) => {
    try {
      const message = JSON.parse(raw) as KickMessage;
      if (typeof message.room === 'string') {
        onKick(message);
      }
    } catch {
      logger('kick channel: dropping unparsable message', raw);
    }
  });
};
