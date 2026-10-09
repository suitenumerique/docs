import { describe, expect, it } from 'vitest';

import { parseConfig } from '../src/config.js';

const base = ['--manifest', 'm.json', '--url', 'wss://docs.example.com/'];

describe('parseConfig', () => {
  it('has the frontend-like defaults', () => {
    const config = parseConfig(base);
    expect(config.url).toBe('wss://docs.example.com');
    expect(config.origin).toBe('https://docs.example.com');
    expect(config.org).toBe('docs');
    expect(config.mode).toBe('wide');
    expect(config.writers).toBe(0.3);
    expect(config.reconnectJitter).toBe(3000);
    expect(config.metricsPort).toBe(9465);
  });

  it('reads every option', () => {
    const config = parseConfig([
      ...base,
      '--clients',
      '500',
      '--ramp',
      '25',
      '--duration',
      '300',
      '--mode',
      'hot',
      '--doc',
      'd1',
      '--writers',
      '0.5',
      '--edit-interval',
      '500',
      '--edit-size',
      '3',
      '--awareness-interval',
      '0',
      '--storm-at',
      '120',
      '--settle',
      '5',
      '--metrics-port',
      '0',
      '--metrics-token',
      't',
      '--origin',
      'http://other',
    ]);
    expect(config).toMatchObject({
      clients: 500,
      ramp: 25,
      duration: 300,
      mode: 'hot',
      doc: 'd1',
      writers: 0.5,
      editInterval: 500,
      editSize: 3,
      awarenessInterval: 0,
      stormAt: 120,
      settle: 5,
      metricsPort: 0,
      metricsToken: 't',
      origin: 'http://other',
    });
  });

  it('nobody writes in idle mode unless asked', () => {
    expect(parseConfig([...base, '--mode', 'idle']).writers).toBe(0);
    expect(
      parseConfig([...base, '--mode', 'idle', '--writers', '0.1']).writers,
    ).toBe(0.1);
  });

  it.each([
    [['--url', 'wss://x'], '--manifest is required'],
    [['--manifest', 'm'], '--url is required'],
    [['--manifest', 'm', '--url', 'https://x'], 'must be ws:// or wss://'],
    [[...base, '--mode', 'other'], '--mode must be one of'],
    [[...base, '--writers', '2'], '--writers must be a number between 0 and 1'],
    [[...base, '--clients', 'abc'], '--clients must be a number'],
    [[...base, '--unknown'], 'Unknown option'],
  ])('refuses %j', (argv, message) => {
    expect(() => parseConfig(argv)).toThrow(message);
  });
});
