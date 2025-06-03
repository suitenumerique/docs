import { createReactInlineContentSpec } from '@blocknote/react';

import { LatexComponent } from './components/LatexComponent';
import { inlineLatexConfig } from './types';
export * from './components/InlineLatexButton';

export const InlineLatex = createReactInlineContentSpec(inlineLatexConfig, {
  render: ({ inlineContent, updateInlineContent }) => (
    <LatexComponent
      updateCatchFocus={(catchFocus) => {
        updateInlineContent({
          type: 'inlineLatex',
          props: {
            formula: inlineContent.props.formula,
            catchFocus: catchFocus,
          },
        });
      }}
      formula={inlineContent.props.formula}
      catchFocus={inlineContent.props.catchFocus}
      updateFormula={(newFormula) => {
        if (newFormula.trim() === '') {
          updateInlineContent({ type: 'text', text: '' });
        } else {
          updateInlineContent({
            type: 'inlineLatex',
            props: {
              formula: newFormula,
            },
          });
        }
      }}
    />
  ),
});
