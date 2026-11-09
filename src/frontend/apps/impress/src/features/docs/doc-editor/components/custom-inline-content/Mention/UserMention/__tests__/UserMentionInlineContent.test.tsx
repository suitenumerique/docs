import {
  BlockNoteEditor,
  BlockNoteSchema,
  defaultInlineContentSpecs,
} from '@blocknote/core';
import { render, screen } from '@testing-library/react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import {
  UserMention,
  UserMentionInlineContent,
} from '../UserMentionInlineContent';

describe('UserMention', () => {
  it('renders the avatar and the full name', () => {
    const { container } = render(<UserMention fullName="Dupont Thomas" />, {
      wrapper: AppWrapper,
    });

    expect(screen.getByText('Dupont Thomas')).toBeInTheDocument();
    expect(
      container.querySelector('.--docs--user-mention-inline-content'),
    ).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('UserMentionInlineContent', () => {
  it('is a user mention carrying the id and the name of the user', () => {
    expect(UserMentionInlineContent.config.type).toBe('userMentionInline');
    expect(UserMentionInlineContent.config.content).toBe('none');
    expect(Object.keys(UserMentionInlineContent.config.propSchema)).toEqual([
      'userId',
      'fullName',
    ]);
  });

  it('exports the name without the avatar in the markdown', async () => {
    const editor = BlockNoteEditor.create({
      schema: BlockNoteSchema.create({
        inlineContentSpecs: {
          ...defaultInlineContentSpecs,
          userMentionInline: UserMentionInlineContent,
        },
      }),
      initialContent: [
        {
          type: 'paragraph',
          content: [
            'Hello ',
            {
              type: 'userMentionInline',
              props: { userId: 'user-id', fullName: 'Dupont Thomas' },
            },
          ],
        },
      ],
    });
    editor.mount(document.createElement('div'));
    // Set by the editor view in the app, the React specs need it to render
    editor.elementRenderer = (node, container) => {
      flushSync(() => createRoot(container).render(node));
    };

    const markdown = await editor.blocksToMarkdownLossy();

    expect(markdown).toContain('@Dupont Thomas');
    expect(markdown).not.toContain('<');

    editor._tiptapEditor.destroy();
  });
});
