import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';

import { useCunninghamTheme } from '@/cunningham';

import { DocsBlockNoteEditor } from '../BlockNoteEditor';

export const DividerBlock = createReactBlockSpec(
  {
    type: 'divider',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
    },
    content: 'none',
  },
  {
    render: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { colorsTokens } = useCunninghamTheme();

      return (
        <div
          style={{
            width: '100%',
            height: '2px',
            backgroundColor: colorsTokens()['greyscale-300'],
            margin: '1rem 0',
          }}
        />
      );
    },
  },
);

export const insertDivider = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
) => ({
  title: t('Divider'),
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: 'divider',
    });
  },
  aliases: ['divider', 'hr', 'horizontal rule', 'line', 'separator'],
  group: t('Others'),
  icon: (
    <span className="material-icons" style={{ fontSize: '18px' }}>
      remove
    </span>
  ),
  subtext: t('Add a horizontal line'),
});
