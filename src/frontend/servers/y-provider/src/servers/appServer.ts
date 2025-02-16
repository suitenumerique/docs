// eslint-disable-next-line import/order
import '../services/sentry';
import * as Sentry from '@sentry/node';
import express from 'express';
import expressWebsockets from 'express-ws';

import { PORT } from '../env';
import {
  collaborationPollPostMessageHandler,
  collaborationPollSSEMessageHandler,
  collaborationPollSyncDocHandler,
  collaborationResetConnectionsHandler,
  collaborationWSHandler,
  convertMarkdownHandler,
} from '../handlers';
import { corsMiddleware, httpSecurity, wsSecurity } from '../middlewares';
import { routes } from '../routes';
import { logger } from '../utils';

/**
 * init the collaboration server.
 *
 * @param port - The port on which the server listens.
 * @param serverSecret - The secret key for API authentication.
 * @returns An object containing the Express app, Hocuspocus server, and HTTP server instance.
 */
export const initServer = () => {
  const { app } = expressWebsockets(express());
  app.use(express.json());
  app.use(corsMiddleware);

  /**
   * Routes to handle collaboration connections
   */
  app.ws(routes.COLLABORATION_WS, wsSecurity, collaborationWSHandler);
  app.get(
    routes.COLLABORATION_POLL_MESSAGE,
    httpSecurity,
    collaborationPollSSEMessageHandler,
  );
  app.post(
    routes.COLLABORATION_POLL_MESSAGE,
    httpSecurity,
    collaborationPollPostMessageHandler,
  );
  app.post(
    routes.COLLABORATION_POLL_SYNC,
    httpSecurity,
    collaborationPollSyncDocHandler,
  );

  /**
   * Route to reset connections in a room:
   *  - If no user ID is provided, close all connections in the room
   *  - If a user ID is provided, close connections for the user in the room
   */
  app.post(
    routes.COLLABORATION_RESET_CONNECTIONS,
    httpSecurity,
    collaborationResetConnectionsHandler,
  );

  /**
   * Route to convert markdown
   */
  app.post(routes.CONVERT_MARKDOWN, httpSecurity, convertMarkdownHandler);

  Sentry.setupExpressErrorHandler(app);

  app.get('/ping', (req, res) => {
    res.status(200).json({ message: 'pong' });
  });

  app.use((req, res) => {
    logger('Invalid route:', req.url);
    res.status(403).json({ error: 'Forbidden' });
  });

  const server = app.listen(PORT, () =>
    console.log('App listening on port :', PORT),
  );

  return { app, server };
};
