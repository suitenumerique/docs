import '@testing-library/jest-dom/vitest';
import * as dotenv from 'dotenv';
import React from 'react';
import { afterEach, expect, vi } from 'vitest';

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

/**
 * Fails a test on the "not wrapped in act" warning of React: a state update
 * landed outside of what the test waited for, so it may pass while the
 * component is not in the state it asserts.
 * `console.error` is replaced rather than spied on, `vi.restoreAllMocks` in a
 * test would remove the spy.
 */
const actWarnings: unknown[] = [];
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (String(args[0]).includes('not wrapped in act(')) {
    actWarnings.push(args[1]);
  }
  consoleError(...args);
};

afterEach(() => {
  expect(actWarnings.splice(0)).toEqual([]);
});
