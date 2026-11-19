import '@testing-library/jest-dom/vitest';
import * as dotenv from 'dotenv';
import React from 'react';
import { afterAll, afterEach, expect, vi } from 'vitest';

dotenv.config({ path: './.env.test', quiet: true });

vi.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => {
    const {
      src,
      alt = '',
      unoptimized: _unoptimized,
      priority: _priority,
      ...rest
    } = props;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const resolved = typeof src === 'string' ? src : src?.src;
    return React.createElement('img', { src: resolved, alt, ...rest });
  },
}));

// jsdom has no canvas: `getContext` returns null as it does, without logging
// "Not implemented" on every call.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
}

/**
 * Fails a test on the "not wrapped in act" warning of React: a state update
 * landed outside of what the test waited for, so it may pass while the
 * component is not in the state it asserts.
 * `console.error` is replaced rather than spied on, `vi.restoreAllMocks` in a
 * test would remove the spy.
 * A warning keeps the name of the test running when it was logged. A late one
 * fails the next check under that test's name, the component it names shows
 * where it came from.
 * A test that mocks `console.error` without forwarding the calls hides these
 * warnings from the check: mock it only for the test that needs it.
 */
const actWarnings: string[] = [];
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = String(args[0]);
  if (message.includes('not wrapped in act(')) {
    const testName = expect.getState().currentTestName ?? 'outside a test';
    // Some of these warnings, like the one of a suspended resource, name no
    // component.
    const source =
      args[1] === undefined ? message.split('\n')[0] : String(args[1]);
    actWarnings.push(`${source} in "${testName}"`);
  }
  consoleError(...args);
};

const expectNoActWarnings = () => {
  expect(actWarnings.splice(0)).toEqual([]);
};
afterEach(expectNoActWarnings);
// Catches the warnings logged after the last test of a file.
afterAll(expectNoActWarnings);
