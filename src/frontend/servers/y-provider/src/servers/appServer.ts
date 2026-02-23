import * as Sentry from '@sentry/node';
import express from 'express';
import expressWebsockets from 'express-ws';

import { CONVERSION_FILE_MAX_SIZE } from '@/env';
import {
  collaborationResetConnectionsHandler,
  collaborationWSHandler,
  convertHandler,
  getDocumentConnectionInfoHandler,
} from '@/handlers';
import { corsMiddleware, httpSecurity, wsSecurity } from '@/middlewares';
import { routes } from '@/routes';
import { logger } from '@/utils';

import '../services/sentry';

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

  app.get(
    routes.COLLABORATION_GET_CONNECTIONS,
    httpSecurity,
    getDocumentConnectionInfoHandler,
  );

  /**
   * Route to convert Markdown or BlockNote blocks and Yjs content
   */
  app.post(
    routes.CONVERT,
    httpSecurity,
    express.raw({
      limit: CONVERSION_FILE_MAX_SIZE,
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
