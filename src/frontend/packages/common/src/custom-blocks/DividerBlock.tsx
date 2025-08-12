import { BlockNoteEditor, insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';

interface DividerBlockProps {
  color?: string;
}

export const createDividerBlock = ({ color }: DividerBlockProps) => {
  return createReactBlockSpec(
    {
      type: 'divider',
      propSchema: {},
      content: 'none',
    },
    {
      render: () => {
        return (
          <hr
            style={{
              width: '100%',
              background: color,
              margin: '1rem 0',
              border: `1px solid ${color}`,
            }}
          />
        );
      },
    },
  );
};

export const getDividerReactSlashMenuItems = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: BlockNoteEditor<any, any, any>,
  t: TFunction<'translation', undefined>,
  group: string,
  icon: React.ReactNode,
) => [
  {
    title: t('Divider'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'divider',
      });
    },
    aliases: ['divider', 'hr', 'horizontal rule', 'line', 'separator'],
    group,
    icon,
    subtext: t('Add a horizontal line'),
  },
];
