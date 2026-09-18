/**
 * Error reporting. Preloaded with `node --import ./dist/sentry.js`, the way
 * y-provider does it: the SDK hooks the modules it instruments as they are
 * loaded, so it has to be initialised before `server.ts` imports any of them.
 *
 * Everything is read from the environment (`config.ts`), and without a
 * `SENTRY_DSN` nothing happens at all — the SDK is imported on demand, so a
 * deployment that does not use Sentry does not pay for it.
 *
 * What reaches Sentry:
 *   - uncaught exceptions and unhandled rejections;
 *   - every `error` and `fatal` line of the pino logger, ours and yhub's — it is
 *     one logger, and it is where a failed upgrade, compaction or migration ends
 *     up, none of them being thrown to anything that could report it;
 *   - traces and profiles, when their sampling rates ask for them.
 */
import {
  ROLE,
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  SENTRY_PROFILES_SAMPLE_RATE,
  SENTRY_RELEASE,
  SENTRY_TRACES_SAMPLE_RATE,
} from './config.js';

if (SENTRY_DSN) {
  const Sentry = await import('@sentry/node');

  const integrations = [
    Sentry.pinoIntegration({ error: { levels: ['error', 'fatal'] } }),
    // Node ends the process on an unhandled rejection. The SDK's default would
    // report it and carry on, which makes a server behave differently with and
    // without error reporting: report it, then end as Node would have.
    Sentry.onUnhandledRejectionIntegration({ mode: 'strict' }),
  ];
  if (SENTRY_PROFILES_SAMPLE_RATE > 0) {
    // a native module: only loaded by the deployments that profile
    const { nodeProfilingIntegration } = await import('@sentry/profiling-node');
    integrations.push(nodeProfilingIntegration());
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    integrations,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    profilesSampleRate: SENTRY_PROFILES_SAMPLE_RATE,
  });
  Sentry.setTag('application', 'yhub-server');
  // the server and the worker are the same image: tell them apart
  Sentry.setTag('role', ROLE);
}
