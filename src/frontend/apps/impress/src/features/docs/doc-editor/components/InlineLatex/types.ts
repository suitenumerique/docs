import {
  InlineContent,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core';

export type InlineLatexProps = {
  inlineContent: InlineContent<InlineContentSchema, StyleSchema>;
  contentRef?: (node: HTMLElement | null) => void;
};

export type InlineLatexConfig = {
  type: 'inlineLatex';
  propSchema: {
    formula: {
      default: '';
    };
  };
  content: 'none';
};

export const inlineLatexConfig: InlineLatexConfig = {
  type: 'inlineLatex',
  propSchema: {
    formula: {
      default: '',
    },
  },
  content: 'none',
};
