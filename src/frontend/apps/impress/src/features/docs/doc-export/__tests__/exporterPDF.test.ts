import { describe, expect, it } from 'vitest';

import { blockNoteSchema } from '@/docs/doc-editor/components/BlockNoteEditor';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { DocsPDFExporter, getPdfDocsStyleRules } from '../exporterPDF';
import { getPdfDocsSchemaMappings } from '../mappingPDF';

type DocsDocument = DocsBlockNoteEditor['document'];

const paragraph = (id: string, text: string, children: unknown[] = []) => ({
  id,
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text, styles: {} }],
  children,
});

describe('getPdfDocsStyleRules', () => {
  it('sizes the headings like the editor', () => {
    const rules = getPdfDocsStyleRules(12);

    expect(rules).toContain(
      '#show heading.where(level: 1): set text(size: 22.5pt)',
    );
    expect(rules).toContain(
      '#show heading.where(level: 2): set text(size: 18pt)',
    );
    expect(rules).toContain(
      '#show heading.where(level: 6): set text(size: 10.5pt)',
    );
  });

  it('colors and underlines the links like the editor', () => {
    const rules = getPdfDocsStyleRules(12);

    expect(rules).toContain('#show link: set text(fill: rgb("#5D5D70"))');
    expect(rules).toContain('#show link: underline');
  });
});

describe('DocsPDFExporter', () => {
  it('places the Docs rules once, between the preamble and the content', async () => {
    const typst = await new DocsPDFExporter(
      blockNoteSchema,
      getPdfDocsSchemaMappings(new Map(), 'Image unavailable'),
    ).toTypst([
      paragraph('parent', 'Parent', [paragraph('child', 'Child')]),
    ] as unknown as DocsDocument);

    const rules = getPdfDocsStyleRules(12);
    const rulesIndex = typst.indexOf(rules);

    expect(typst.split(rules)).toHaveLength(2);
    // After the preamble rules they override
    expect(rulesIndex).toBeGreaterThan(
      typst.indexOf('#show heading.where(level: 1): set text(size: 36pt)'),
    );
    expect(rulesIndex).toBeGreaterThan(typst.indexOf('#show link:'));
    expect(rulesIndex).toBeLessThan(typst.indexOf('Parent'));
  });
});
