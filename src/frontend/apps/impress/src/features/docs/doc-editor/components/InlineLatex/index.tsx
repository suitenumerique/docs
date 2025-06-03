import { createReactInlineContentSpec } from '@blocknote/react';

import { LatexComponent } from './components/LatexComponent';
import { inlineLatexConfig } from './types';
export * from './components/InlineLatexButton';

export const InlineLatex = createReactInlineContentSpec(inlineLatexConfig, {
  render: ({ inlineContent, updateInlineContent }) => (
    <LatexComponent
      formula={inlineContent.props.formula}
      updateFormula={(newFormula) => {
        if (newFormula.trim() === '') {
          updateInlineContent({ type: 'inlineLatex', props: { formula: '' } });
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
