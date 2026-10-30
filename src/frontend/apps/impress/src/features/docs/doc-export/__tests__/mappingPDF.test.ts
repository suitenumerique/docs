import { PDFExporter } from '@blocknote/xl-pdf-exporter';
import { describe, expect, it } from 'vitest';

import { blockNoteSchema } from '@/docs/doc-editor/components/BlockNoteEditor';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { fitColumnWidths, getPdfDocsSchemaMappings } from '../mappingPDF';

type DocsDocument = DocsBlockNoteEditor['document'];

const toTypst = (
  blocks: Record<string, unknown>[],
  titles = new Map<string, string>(),
) =>
  new PDFExporter(
    blockNoteSchema,
    getPdfDocsSchemaMappings(titles, 'Image unavailable'),
  ).toTypst(
    blocks.map((block, index) => ({
      id: `block-${index}`,
      props: {},
      content: undefined,
      children: [],
      ...block,
    })) as unknown as DocsDocument,
  );

describe('fitColumnWidths', () => {
  it('keeps the widths when the table fits in the page', () => {
    expect(fitColumnWidths([100, undefined, 200], 600)).toEqual([
      100,
      undefined,
      200,
    ]);
  });

  it('drops NaN widths so that Typst sizes the column', () => {
    expect(fitColumnWidths([NaN, 100], 600)).toEqual([undefined, 100]);
  });

  it('scales the widths down when the table is wider than the page', () => {
    expect(fitColumnWidths([400, 800], 600)).toEqual([200, 400]);
  });

  it('keeps room for the columns without a width when scaling down', () => {
    // The column without a width counts as 120px: 480 + 120 + 600 = 1200
    expect(fitColumnWidths([480, undefined, 600], 600)).toEqual([240, 60, 300]);
  });
});

describe('getPdfDocsSchemaMappings', () => {
  it('renders a callout with its emoji and its background', async () => {
    const typst = await toTypst([
      {
        type: 'callout',
        props: { emoji: '🚀', backgroundColor: 'yellow' },
        content: [{ type: 'text', text: 'Launch', styles: {} }],
      },
    ]);

    expect(typst).toContain(
      '#grid(columns: (auto, 1fr), column-gutter: 6pt, [#"🚀"], [#"Launch"])',
    );
    expect(typst).toMatch(/#block\(width: 100%, fill: rgb\("#[0-9a-f]+"\)/i);
  });

  it('renders an upload loader with its state icon', async () => {
    const typst = await toTypst([
      {
        type: 'uploadLoader',
        props: { type: 'warning', information: 'Upload failed' },
      },
    ]);

    expect(typst).toContain('#"⚠️ Upload failed"');
  });

  it('renders an interlink as a link to the document', async () => {
    const typst = await toTypst(
      [
        {
          type: 'paragraph',
          content: [
            {
              type: 'interlinkingLinkInline',
              props: { docId: 'doc-1', title: '' },
            },
            {
              type: 'interlinkingLinkInline',
              props: { docId: 'doc-2', title: '' },
            },
          ],
        },
      ],
      new Map([
        ['doc-1', '🎉 Party'],
        ['doc-2', 'Plain'],
      ]),
    );

    expect(typst).toContain(
      `#link("${window.location.origin}/docs/doc-1/")[#"🎉 Party"]`,
    );
    expect(typst).toContain(
      `#pdf.artifact[📄 ]#link("${window.location.origin}/docs/doc-2/")[#"Plain"]`,
    );
  });

  it('renders a pdf block as a link to the file', async () => {
    const typst = await toTypst([
      {
        type: 'pdf',
        props: { url: 'https://example.com/file.pdf', name: 'file.pdf' },
      },
    ]);

    expect(typst).toContain(
      '#link("https://example.com/file.pdf")[#"file.pdf"]',
    );
  });

  it('renders math blocks and inline math as Typst equations', async () => {
    const typst = await toTypst([
      {
        type: 'mathBlock',
        content: [{ type: 'text', text: 'x^2', styles: {} }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'math', props: {}, content: 'y_1' }],
      },
    ]);

    expect(typst).toContain('#math.equation(block: true, alt: "x^2", $ x^2 $)');
    expect(typst).toContain('#math.equation(alt: "y_1", $y_1$)');
  });

  it('fits a table wider than the page', async () => {
    const typst = await toTypst([
      {
        type: 'table',
        content: {
          type: 'tableContent',
          columnWidths: [800, 800],
          rows: [
            {
              cells: [
                [{ type: 'text', text: 'A', styles: {} }],
                [{ type: 'text', text: 'B', styles: {} }],
              ],
            },
          ],
        },
      },
    ]);

    // Each column is scaled down to half of the page content width (665px)
    expect(typst).toContain('columns: (249.0pt, 249.0pt)');
  });
});
