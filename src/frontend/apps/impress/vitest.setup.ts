import '@testing-library/jest-dom/vitest';
import * as dotenv from 'dotenv';
import React from 'react';
import { vi } from 'vitest';

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
