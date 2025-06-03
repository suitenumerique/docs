import { defaultProps } from '@blocknote/core';

export const defaultFormula = 'x';

export const blockSpec = {
  type: 'chart',
  propSchema: {
    formula: {
      default: defaultFormula,
    },
    backgroundColor: defaultProps.backgroundColor,
  },
  content: 'none',
} as const;
