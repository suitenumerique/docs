// eslint-disable-next-line import/order
import '../services/sentry';

import * as Sentry from '@sentry/node';
import express from 'express';
import expressWebsockets from 'express-ws';

import {
  collaborationResetConnectionsHandler,
  collaborationWSHandler,
  convertHandler,
} from '@/handlers';
import { corsMiddleware, httpSecurity, wsSecurity } from '@/middlewares';
import { routes } from '@/routes';
import { logger } from '@/utils';

/**
 * init the collaboration server.
 *
 * @returns An object containing the Express app, Hocuspocus server, and HTTP server instance.
 */
export const initApp = () => {
  const { app } = expressWebsockets(express());

  app.use(corsMiddleware);

  /**
   * Route to handle WebSocket connections
   */
  app.ws(routes.COLLABORATION_WS, wsSecurity, collaborationWSHandler);

  /**
   * Route to reset connections in a room:
   *  - If no user ID is provided, close all connections in the room
   *  - If a user ID is provided, close connections for the user in the room
   */
  app.post(
    routes.COLLABORATION_RESET_CONNECTIONS,
    httpSecurity,
    express.json(),
    collaborationResetConnectionsHandler,
  );

  /**
   * Route to convert Markdown or BlockNote blocks
   */
  app.post(
    routes.CONVERT,
    httpSecurity,
    express.raw({
      limit: '500kb',
      type: '*/*',
    }),
    convertHandler,
  );

  Sentry.setupExpressErrorHandler(app);

  app.get('/ping', (req, res) => {
    res.status(200).json({ message: 'pong' });
  });

  app.use((req, res) => {
    logger('Invalid route:', req.url);
    res.status(403).json({ error: 'Forbidden' });
  });

  return app;
};
