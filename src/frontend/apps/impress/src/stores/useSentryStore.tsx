import type { Client } from '@sentry/core';
import * as Sentry from '@sentry/nextjs';
import { create } from 'zustand';

import packageJson from '../../package.json';

interface SentryState {
  sentry?: Client;
  setSentry: (dsn?: string, environment?: string) => void;
}

export const useSentryStore = create<SentryState>((set, get) => ({
  sentry: undefined,
  setSentry: (dsn, environment) => {
    if (get().sentry) {
      return;
    }

    const sentry = Sentry.init({
      dsn,
      environment,
      integrations: [Sentry.replayIntegration()],
      release: packageJson.version,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      tracesSampleRate: 0.1,
    });
    Sentry.setTag('application', 'frontend');

    set({ sentry });
  },
}));
