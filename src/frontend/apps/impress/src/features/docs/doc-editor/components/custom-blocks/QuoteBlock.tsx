import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React from 'react';

import { useCunninghamTheme } from '@/cunningham';

import { DocsBlockNoteEditor } from '../BlockNoteEditor';

export const QuoteBlock = createReactBlockSpec(
  {
    type: 'quote',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
    },
    content: 'inline',
  },
  {
    render: (props) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { colorsTokens } = useCunninghamTheme();

      return (
        <div
          className="inline-content"
          style={{
            borderLeft: `4px solid ${colorsTokens()['greyscale-300']}`,
            margin: '0 0 1rem 0',
            padding: '0.5rem 1rem',
            color: colorsTokens()['greyscale-600'],
            fontStyle: 'italic',
            flexGrow: 1,
          }}
          ref={props.contentRef}
        />
      );
    },
    parse: () => {
      return undefined;
    },
  },
);

export const insertQuote = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
) => ({
  title: t('Quote'),
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: 'quote',
    });
  },
  aliases: ['quote', 'blockquote', 'citation'],
  group: t('Others'),
  icon: (
    <span className="material-icons" style={{ fontSize: '18px' }}>
      format_quote
    </span>
  ),
  subtext: t('Add a quote block'),
});
