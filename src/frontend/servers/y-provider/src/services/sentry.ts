import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import { SENTRY_DSN } from '../env';

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 0.1,
  // every process profiles the traces it samples, as `profilesSampleRate: 1`
  // did before Sentry 11
  profileSessionSampleRate: 1.0,
  profileLifecycle: 'trace',
});
Sentry.setTag('application', 'y-provider');
