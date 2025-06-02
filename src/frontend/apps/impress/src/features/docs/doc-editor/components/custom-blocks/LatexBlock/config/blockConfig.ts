import { defaultProps } from '@blocknote/core';

export const defaultFormula =
  '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}';

export const blockSpec = {
  type: 'latex',
  propSchema: {
    formula: {
      default: defaultFormula,
    },
    textAlignment: defaultProps.textAlignment,
    backgroundColor: defaultProps.backgroundColor,
  },
  content: 'none',
} as const;
