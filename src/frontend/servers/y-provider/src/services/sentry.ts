import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import packageJson from '../../package.json';
import { SENTRY_DSN } from '../env';

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  profilesSampleRate: 1.0,
  release: packageJson.version,
  tracesSampleRate: 0.1,
});
Sentry.setTag('application', 'y-provider');
