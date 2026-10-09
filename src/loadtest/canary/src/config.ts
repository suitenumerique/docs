/**
 * Everything the canary is told, from the command line, validated once here.
 *
 *   canary --manifest m.json --url https://docs.example.com --pairs 3 --duration 600
 */
import { parseArgs } from 'node:util';

export interface Config {
  manifest: string;
  /** The frontend, `https://host`. */
  url: string;
  /** Pairs of browsers (a writer and a reader on one document). */
  pairs: number;
  /** Seconds to run. */
  duration: number;
  /** Seconds a pair waits between two iterations. */
  interval: number;
  /** The document every pair opens; else each pair opens one of its user's. */
  doc?: string;
  /** Seconds before an open or a propagation is given up on. */
  timeout: number;
  headless: boolean;
  /** Playwright's `storageState` file, in place of the manifest's cookies. */
  storageState?: string;
  metricsPort: number;
  metricsToken: string;
  report: string;
  /** Where screenshots of failed iterations go, empty for none. */
  screenshots: string;
}

const number = (
  name: string,
  raw: string | undefined,
  dflt: number,
  min: number,
  max = Infinity,
): number => {
  if (raw === undefined || raw === '') return dflt;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(
      `--${name} must be a number between ${min} and ${max} (got "${raw}")`,
    );
  }
  return value;
};

export const parseConfig = (argv: string[]): Config => {
  const { values } = parseArgs({
    args: argv,
    options: {
      manifest: { type: 'string' },
      url: { type: 'string' },
      pairs: { type: 'string' },
      duration: { type: 'string' },
      interval: { type: 'string' },
      doc: { type: 'string' },
      timeout: { type: 'string' },
      headed: { type: 'boolean', default: false },
      'storage-state': { type: 'string' },
      'metrics-port': { type: 'string' },
      'metrics-token': { type: 'string', default: '' },
      report: { type: 'string', default: '-' },
      screenshots: { type: 'string', default: '' },
    },
    strict: true,
  });
  if (!values.manifest && !values['storage-state']) {
    throw new Error('--manifest is required (or --storage-state with --doc)');
  }
  if (!values.url)
    throw new Error('--url is required (https://host of the frontend)');
  let url: URL;
  try {
    url = new URL(values.url);
  } catch {
    throw new Error(`--url is not a url (got "${values.url}")`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`--url must be http:// or https:// (got "${values.url}")`);
  }
  if (values['storage-state'] && !values.doc) {
    throw new Error(
      '--storage-state needs --doc: without the manifest there is no list of documents',
    );
  }
  return {
    manifest: values.manifest ?? '',
    url: values.url.replace(/\/+$/, ''),
    pairs: number('pairs', values.pairs, 2, 1, 50),
    duration: number('duration', values.duration, 300, 1),
    interval: number('interval', values.interval, 5, 0),
    doc: values.doc,
    timeout: number('timeout', values.timeout, 30, 1),
    headless: !values.headed,
    storageState: values['storage-state'],
    metricsPort: number('metrics-port', values['metrics-port'], 9466, 0, 65535),
    metricsToken: values['metrics-token'] ?? '',
    report: values.report ?? '-',
    screenshots: values.screenshots ?? '',
  };
};
