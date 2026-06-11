import { createAuthPlugin } from '@y/hub';

import { YHUB_BRANCH, YHUB_ORG } from '@/routes';
import { logger } from '@/utils';

import { TokenClaims, consumeToken } from './internalToken';

/**
 * Auth plugin for the embedded @y/hub server. The gateway has already
 * authenticated the user against Django; it hands the result over through a
 * single-use token in the `yauth` query parameter of the internal dial.
 */
export const createGatewayAuthPlugin = () =>
  createAuthPlugin<TokenClaims>({
    readAuthInfo: (req) => {
      // The uws request is only valid synchronously — read the query before
      // any await. consumeToken is a synchronous Map lookup, so this whole
      // handler completes before uws invalidates the request.
      const token = new URLSearchParams(req.getQuery() ?? '').get('yauth');
      const claims = token ? consumeToken(token) : null;
      if (!claims) {
        logger('yhub auth: invalid or expired internal token');
        throw new Error('Invalid internal token');
      }
      return Promise.resolve(claims);
    },
    getAccessType: (authInfo, room) => {
      // The token is bound to a single room: a replayed or misrouted token
      // cannot open any other document.
      if (
        room.org !== YHUB_ORG ||
        room.branch !== YHUB_BRANCH ||
        room.docid !== authInfo.room
      ) {
        return Promise.resolve(null);
      }
      return Promise.resolve(authInfo.canEdit ? 'rw' : 'r');
    },
  });
