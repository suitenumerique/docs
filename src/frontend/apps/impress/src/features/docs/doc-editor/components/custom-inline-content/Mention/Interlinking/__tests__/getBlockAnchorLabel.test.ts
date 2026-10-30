import { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { type DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import {
  BLOCK_ANCHOR_LABEL_MAX_CHARS,
  getBlockAnchorLabel as getAnchorLabel,
} from '../getBlockAnchorLabel';

const t = ((key: string) => key) as unknown as TFunction;

/** The text of the label: most tests do not care about `isFallback` */
const getBlockAnchorLabel = (...args: Parameters<typeof getAnchorLabel>) => {
  const label = getAnchorLabel(...args);

  return label ? label.text : label;
};

const makeEditor = (
  content?: unknown,
  type = 'paragraph',
  props: Record<string, unknown> = {},
) =>
  ({
    getBlock: (id: string) =>
      id === 'block-1' ? { id, type, props, content } : undefined,
  }) as unknown as DocsBlockNoteEditor;

describe('getBlockAnchorLabel', () => {
  it('returns the text of the block', () => {
    const editor = makeEditor([
      { type: 'text', text: 'Hello world', styles: {} },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1', t)).toBe('Hello world');
  });

  it('keeps the first 5 words and adds an ellipsis', () => {
    const editor = makeEditor([
      { type: 'text', text: 'one two three four five six seven', styles: {} },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1', t)).toBe(
      'one two three four five…',
    );
  });

  it('does not add an ellipsis for exactly 5 words', () => {
    const editor = makeEditor([
      { type: 'text', text: 'one two three four five', styles: {} },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1', t)).toBe(
      'one two three four five',
    );
  });

  it('reads only the start of a long block', () => {
    const longWord = 'x'.repeat(BLOCK_ANCHOR_LABEL_MAX_CHARS);
    const editor = makeEditor([
      { type: 'text', text: `one ${longWord}`, styles: {} },
      { type: 'text', text: 'never read', styles: {} },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1', t)).toBe(
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

    expect(getBlockAnchorLabel(editor, 'block-1', t)).toBe('hello');
  });

  it('ignores the whitespace before the text', () => {
    const editor = makeEditor([
      {
        type: 'text',
        text: `${' '.repeat(BLOCK_ANCHOR_LABEL_MAX_CHARS)}hello`,
        styles: {},
      },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1', t)).toBe('hello');
  });

  it('keeps the leading whitespace of a split text from eating the label', () => {
    const editor = makeEditor([
      {
        type: 'text',
        text: ' '.repeat(BLOCK_ANCHOR_LABEL_MAX_CHARS),
        styles: {},
      },
      { type: 'text', text: `  hello${'x'.repeat(1000)}`, styles: {} },
    ]);

    expect(getBlockAnchorLabel(editor, 'block-1', t)).toBe(
      `hello${'x'.repeat(BLOCK_ANCHOR_LABEL_MAX_CHARS - 'hello'.length)}…`,
    );
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

    expect(getBlockAnchorLabel(editor, 'block-1', t)).toBe('See the docs');
  });

  it('returns undefined when the block does not exist', () => {
    expect(getBlockAnchorLabel(makeEditor([]), 'unknown', t)).toBeUndefined();
  });

  it('names a text block that holds no text "Empty block"', () => {
    expect(getBlockAnchorLabel(makeEditor([]), 'block-1', t)).toBe(
      'Empty block',
    );
    expect(
      getBlockAnchorLabel(
        makeEditor([{ type: 'text', text: '  ', styles: {} }]),
        'block-1',
        t,
      ),
    ).toBe('Empty block');
  });

  it('tells a text of the block from a name made up for it', () => {
    const isFallback = (type: string, props = {}, content?: unknown) =>
      getAnchorLabel(makeEditor(content, type, props), 'block-1', t)
        ?.isFallback;

    expect(isFallback('paragraph', {}, [{ type: 'text', text: 'Hi' }])).toBe(
      false,
    );
    expect(isFallback('image', { caption: 'A view' })).toBe(false);
    expect(isFallback('file', { name: 'report.pdf' })).toBe(false);
    expect(
      isFallback(
        'table',
        {},
        { rows: [{ cells: [[{ type: 'text', text: 'Cell' }]] }] },
      ),
    ).toBe(false);

    expect(isFallback('paragraph', {}, [])).toBe(true);
    expect(isFallback('image', { caption: '', name: '' })).toBe(true);
    expect(isFallback('divider')).toBe(true);
    expect(isFallback('codeBlock')).toBe(true);
  });

  describe('block without text', () => {
    const label = (type: string, props = {}, content?: unknown) =>
      getBlockAnchorLabel(makeEditor(content, type, props), 'block-1', t);

    it('shows the caption of an image, else its file name, else its type', () => {
      expect(label('image', { caption: 'A nice view', name: 'a.png' })).toBe(
        'A nice view',
      );
      expect(label('image', { caption: '', name: 'a.png' })).toBe('a.png');
      expect(label('image', { caption: '', name: '' })).toBe('Image');
    });

    it('crops the caption of an image to 5 words', () => {
      expect(label('image', { caption: 'one two three four five six' })).toBe(
        'one two three four five…',
      );
    });

    it.each([
      ['video', 'Video'],
      ['audio', 'Audio'],
      ['file', 'File'],
      ['pdf', 'PDF'],
    ])(
      'shows the caption of a %s, else its name, else its type',
      (type, typeLabel) => {
        expect(label(type, { caption: 'Yearly report', name: 'r.pdf' })).toBe(
          'Yearly report',
        );
        expect(label(type, { caption: '', name: 'Report 2026.pdf' })).toBe(
          'Report 2026.pdf',
        );
        expect(label(type, { name: '' })).toBe(typeLabel);
      },
    );

    it('crops a long file name like a text', () => {
      expect(
        label('file', { name: 'one two three four five six seven.pdf' }),
      ).toBe('one two three four five…');
      expect(
        label('pdf', {
          name: `${'x'.repeat(BLOCK_ANCHOR_LABEL_MAX_CHARS * 2)}`,
        }),
      ).toBe(`${'x'.repeat(BLOCK_ANCHOR_LABEL_MAX_CHARS)}…`);
    });

    it('shows the first cell of a table, cropped to 5 words', () => {
      const cell = [{ type: 'text', text: 'one two three four five six' }];
      const tableCell = { type: 'tableCell', content: cell };

      expect(label('table', {}, { rows: [{ cells: [cell] }] })).toBe(
        'one two three four five…',
      );
      expect(label('table', {}, { rows: [{ cells: [tableCell] }] })).toBe(
        'one two three four five…',
      );
      expect(label('table', {}, { rows: [{ cells: [[]] }] })).toBe('Table');
    });

    it.each([
      ['codeBlock', 'Code block'],
      ['mathBlock', 'Math'],
      ['diagram', 'Diagram'],
      ['divider', 'Separator'],
      ['pageBreak', 'Page break'],
    ])('shows the type of a %s', (type, typeLabel) => {
      expect(
        label(type, {}, [{ type: 'text', text: 'some code', styles: {} }]),
      ).toBe(typeLabel);
    });

    it('has nothing to show for a block without inline content', () => {
      expect(label('docChildren')).toBeNull();
      expect(label('paragraph', {}, { type: 'tableContent' })).toBeNull();
    });
  });
});
