import { defaultProps } from '@blocknote/core';

export const defaultFunctions = ['x^2', 'x^3'];

export const blockSpec = {
  type: 'chart',
  propSchema: {
    functions: {
      default: defaultFunctions,
    },
    min: {
      default: -5,
    },
    max: {
      default: 5,
    },
    num: {
      default: 100,
    },
  },
  content: 'none',
} as const;
