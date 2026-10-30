import { Bookmark, ImageRun, TextRun } from 'docx';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  inlineContentMappingUserMentionDocx,
  inlineContentMappingUserMentionODT,
  inlineContentMappingUserMentionPDF,
} from '../inline-content-mapping';

const mention = {
  type: 'userMentionInline' as const,
  props: { userId: 'user-id', fullName: 'Dupont Thomas' },
  content: undefined,
};
const emptyMention = {
  type: 'userMentionInline' as const,
  props: { userId: '', fullName: '' },
  content: undefined,
};

// The exporter is only needed by the mappings that render nested content.
const exporter = {} as never;

const AVATAR_BASE64 = 'iVBORw0KGgo=';

// jsdom has no canvas: the avatar is drawn on a fake one, or on none.
const mockCanvas = (available: boolean) => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      (available
        ? {
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            fillText: vi.fn(),
          }
        : null) as never,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    `data:image/png;base64,${AVATAR_BASE64}`,
  );
};

// The PDF export registers the bytes of the images on its Typst exporter.
const makePdfExporter = () => {
  const registerImageBytes = vi.fn().mockReturnValue('/assets/asset-0');

  return { exporter: { registerImageBytes } as never, registerImageBytes };
};

describe('user mention export mappings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ODT', () => {
    it('exports the avatar and the name', () => {
      mockCanvas(true);

      const element = inlineContentMappingUserMentionODT(
        mention,
        exporter,
      ) as React.ReactElement<{ children: React.ReactNode[] }>;
      const [frame, name] = element.props.children as [
        React.ReactElement<{ 'text:anchor-type': string }>,
        string,
      ];

      expect(frame.type).toBe('draw:frame');
      expect(frame.props['text:anchor-type']).toBe('as-char');
      expect(JSON.stringify(frame)).toContain(AVATAR_BASE64);
      expect(name).toBe(' Dupont Thomas');
    });

    it('exports the name as text without canvas', () => {
      mockCanvas(false);

      expect(inlineContentMappingUserMentionODT(mention, exporter)).toBe(
        '@Dupont Thomas',
      );
    });

    it('exports nothing when the user is missing', () => {
      expect(
        inlineContentMappingUserMentionODT(emptyMention, exporter),
      ).toBeNull();
    });
  });

  describe('Docx', () => {
    it('exports the avatar and the name in a bookmark', () => {
      mockCanvas(true);

      const run = inlineContentMappingUserMentionDocx(mention, exporter);

      expect(run).toBeInstanceOf(Bookmark);
      expect((run as Bookmark).children[0]).toBeInstanceOf(ImageRun);
      expect(JSON.stringify(run)).toContain(' Dupont Thomas');
    });

    it('exports the name as a bold text run without canvas', () => {
      mockCanvas(false);

      const run = inlineContentMappingUserMentionDocx(mention, exporter);

      expect(run).toBeInstanceOf(TextRun);
      expect(JSON.stringify(run)).toContain('@Dupont Thomas');
    });

    it('exports an empty text run when the user is missing', () => {
      const run = inlineContentMappingUserMentionDocx(emptyMention, exporter);

      expect(run).toBeInstanceOf(TextRun);
      expect(JSON.stringify(run)).not.toContain('@');
    });
  });

  describe('PDF', () => {
    it('exports the avatar as an artifact and the name in bold', () => {
      mockCanvas(true);
      const { exporter: pdfExporter, registerImageBytes } = makePdfExporter();

      const typst = inlineContentMappingUserMentionPDF(mention, pdfExporter);

      expect(typst).toBe(
        '#pdf.artifact(box(baseline: 15%, image("/assets/asset-0", width: 9pt)))#h(0.25em)#strong("Dupont Thomas")',
      );
      expect(registerImageBytes).toHaveBeenCalledWith(
        'user-mention|Dupont Thomas',
        expect.any(Uint8Array),
      );
    });

    it('exports the name only without canvas', () => {
      mockCanvas(false);
      const { exporter: pdfExporter, registerImageBytes } = makePdfExporter();

      expect(inlineContentMappingUserMentionPDF(mention, pdfExporter)).toBe(
        '#strong("Dupont Thomas")',
      );
      expect(registerImageBytes).not.toHaveBeenCalled();
    });

    it('exports nothing when the user is missing', () => {
      expect(
        inlineContentMappingUserMentionPDF(
          emptyMention,
          makePdfExporter().exporter,
        ),
      ).toBe('');
    });
  });
});
