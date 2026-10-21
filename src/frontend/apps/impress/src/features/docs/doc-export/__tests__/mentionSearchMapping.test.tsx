import { TextRun } from 'docx';
import { describe, expect, it } from 'vitest';

import {
  inlineContentMappingMentionSearchDocx,
  inlineContentMappingMentionSearchODT,
  inlineContentMappingMentionSearchPDF,
} from '../inline-content-mapping';

const search = {
  type: 'mentionSearchInline' as const,
  props: { trigger: '@', disabled: false },
};

// The exporter is only needed by the mappings that render nested content.
const exporter = {} as never;

describe('mention search export mappings', () => {
  it('exports nothing in ODT', () => {
    expect(
      inlineContentMappingMentionSearchODT(search as never, exporter),
    ).toBeNull();
  });

  it('exports an empty text run in Docx', () => {
    const run = inlineContentMappingMentionSearchDocx(
      search as never,
      exporter,
    );

    expect(run).toBeInstanceOf(TextRun);
    expect(JSON.stringify(run)).not.toContain('@');
  });

  it('exports nothing in PDF', () => {
    const element = inlineContentMappingMentionSearchPDF(
      search as never,
      exporter,
    ) as unknown as React.ReactElement<{ children?: unknown }>;

    expect(element.props.children).toBeUndefined();
  });
});
