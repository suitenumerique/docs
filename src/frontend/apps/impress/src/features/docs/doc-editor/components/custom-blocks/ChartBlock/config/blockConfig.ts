import { defaultProps } from '@blocknote/core';

export const defaultFunctions = ['(0.5 - e^{-x-5})*\\cos(x+2)', '0.05*x'];

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
      default: 200,
    },
  },
  content: 'none',
} as const;
