import { describe, expect, it } from 'vitest';

import { type DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import {
  BLOCK_ANCHOR_LABEL_MAX_CHARS,
  getBlockAnchorLabel,
} from '../getBlockAnchorLabel';

const makeEditor = (content?: unknown) =>
  ({
    getBlock: (id: string) => (id === 'block-1' ? { id, content } : undefined),
  }) as unknown as DocsBlockNoteEditor;

describe('getBlockAnchorLabel', () => {
  it('returns the text of the block', () => {
    const editor = makeEditor([
      { type: 'text', text: 'Hello world', styles: {} },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1')).toBe('Hello world');
  });

  it('keeps the first 5 words and adds an ellipsis', () => {
    const editor = makeEditor([
      { type: 'text', text: 'one two three four five six seven', styles: {} },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1')).toBe(
      'one two three four five…',
    );
  });

  it('does not add an ellipsis for exactly 5 words', () => {
    const editor = makeEditor([
      { type: 'text', text: 'one two three four five', styles: {} },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1')).toBe(
      'one two three four five',
    );
  });

  it('reads only the start of a long block', () => {
    const longWord = 'x'.repeat(BLOCK_ANCHOR_LABEL_MAX_CHARS);
    const editor = makeEditor([
      { type: 'text', text: `one ${longWord}`, styles: {} },
      { type: 'text', text: 'never read', styles: {} },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1')).toBe(
      `one ${longWord.slice(0, BLOCK_ANCHOR_LABEL_MAX_CHARS - 4)}…`,
    );
  });

  it('does not add an ellipsis when only whitespace is left out', () => {
    const editor = makeEditor([
      {
        type: 'text',
        text: `hello${' '.repeat(BLOCK_ANCHOR_LABEL_MAX_CHARS)}`,
        styles: {},
      },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1')).toBe('hello');
  });

  it('joins styled texts and reads the text of links', () => {
    const editor = makeEditor([
      { type: 'text', text: 'See ', styles: {} },
      {
        type: 'link',
        href: 'https://example.com',
        content: [{ type: 'text', text: 'the  docs', styles: { bold: true } }],
      },
      { type: 'interlinkingLinkInline', props: { docId: 'x' } },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1')).toBe('See the docs');
  });

  it('returns null when the block does not exist', () => {
    expect(getBlockAnchorLabel(makeEditor([]), 'unknown')).toBeNull();
  });

  it('returns null when the block holds no text', () => {
    expect(getBlockAnchorLabel(makeEditor(undefined), 'block-1')).toBeNull();
    expect(
      getBlockAnchorLabel(makeEditor({ type: 'tableContent' }), 'block-1'),
    ).toBeNull();
    expect(
      getBlockAnchorLabel(
        makeEditor([{ type: 'text', text: '  ', styles: {} }]),
        'block-1',
      ),
    ).toBeNull();
  });
});
