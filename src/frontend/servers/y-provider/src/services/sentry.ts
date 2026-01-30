import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import { SENTRY_DSN } from '../env';

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  profilesSampleRate: 1.0,
  release: process.env.npm_package_version,
  tracesSampleRate: 0.1,
});
Sentry.setTag('application', 'y-provider');
