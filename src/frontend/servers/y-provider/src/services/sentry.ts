import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import { SENTRY_DSN, SENTRY_ENV } from '../env';

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 0.1,
  profilesSampleRate: 1.0,
  environment: SENTRY_ENV,
});
