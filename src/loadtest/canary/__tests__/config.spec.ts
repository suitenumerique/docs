import { describe, expect, it } from 'vitest';

import { parseConfig } from '../src/config.js';

const base = ['--manifest', 'm.json', '--url', 'https://docs.example.com/'];

describe('parseConfig', () => {
  it('has defaults', () => {
    const config = parseConfig(base);
    expect(config.url).toBe('https://docs.example.com');
    expect(config.pairs).toBe(2);
    expect(config.duration).toBe(300);
    expect(config.interval).toBe(5);
    expect(config.timeout).toBe(30);
    expect(config.headless).toBe(true);
    expect(config.metricsPort).toBe(9466);
  });

  it('reads every option', () => {
    const config = parseConfig([
      ...base,
      '--pairs',
      '4',
      '--duration',
      '60',
      '--interval',
      '0',
      '--doc',
      'd',
      '--timeout',
      '10',
      '--headed',
      '--metrics-port',
      '0',
      '--metrics-token',
      't',
      '--report',
      'r.json',
      '--screenshots',
      'shots',
    ]);
    expect(config).toMatchObject({
      pairs: 4,
      duration: 60,
      interval: 0,
      doc: 'd',
      timeout: 10,
      headless: false,
      metricsPort: 0,
      metricsToken: 't',
      report: 'r.json',
      screenshots: 'shots',
    });
  });

  it('accepts a storage state in place of the manifest, with a document', () => {
    const config = parseConfig([
      '--url',
      'https://x',
      '--storage-state',
      's.json',
      '--doc',
      'd',
    ]);
    expect(config.manifest).toBe('');
    expect(config.storageState).toBe('s.json');
  });

  it.each([
    [['--url', 'https://x'], '--manifest is required'],
    [
      ['--url', 'https://x', '--storage-state', 's'],
      '--storage-state needs --doc',
    ],
    [['--manifest', 'm'], '--url is required'],
    [['--manifest', 'm', '--url', 'wss://x'], 'must be http:// or https://'],
    [[...base, '--pairs', '0'], '--pairs must be a number'],
    [[...base, '--unknown'], 'Unknown option'],
  ])('refuses %j', (argv, message) => {
    expect(() => parseConfig(argv)).toThrow(message);
  });
});
