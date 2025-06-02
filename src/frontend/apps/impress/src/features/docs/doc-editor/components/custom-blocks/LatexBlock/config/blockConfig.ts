export const defaultFormula =
  '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{2\\pi}';

export const blockSpec = {
  type: 'latex',
  propSchema: {
    formula: {
      default: defaultFormula,
    },
  },
  content: 'none',
} as const;
