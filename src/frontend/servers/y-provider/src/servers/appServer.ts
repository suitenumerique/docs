import * as Sentry from '@sentry/node';
import express from 'express';

import { CONVERSION_FILE_MAX_SIZE } from '@/env';
import { convertHandler } from '@/handlers';
import { corsMiddleware, httpSecurity } from '@/middlewares';
import { routes } from '@/routes';
import { logger } from '@/utils';

import '../services/sentry';

/**
 * init the conversion server.
 *
 * @returns The Express app instance.
 */
export const initApp = () => {
  const app = express();

  app.use(corsMiddleware);

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
