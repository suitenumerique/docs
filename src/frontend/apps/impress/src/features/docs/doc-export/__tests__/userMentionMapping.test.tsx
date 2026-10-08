import { Image } from '@react-pdf/renderer';
import { Bookmark, TextRun } from 'docx';
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

const findImage = (node: React.ReactNode): React.ReactElement | undefined => {
  let found: React.ReactElement | undefined;

  React.Children.forEach(node, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) {
      return;
    }

    found =
      found ?? (child.type === Image ? child : findImage(child.props.children));
  });

  return found;
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
      const [space, frame, name] = element.props.children as [
        string,
        React.ReactElement<{ 'text:anchor-type': string }>,
        string,
      ];

      expect(space).toBe(' ');
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
      // The space before the avatar, as in the editor
      expect(JSON.stringify(run)).toContain(' ');
      expect(JSON.stringify(run)).toContain('Dupont Thomas');
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
    it('exports the avatar as an image and the name in bold', () => {
      mockCanvas(true);

      const element = inlineContentMappingUserMentionPDF(
        mention,
        exporter,
      ) as unknown as React.ReactElement<{
        style: unknown;
        children: React.ReactNode;
      }>;

      expect(element.props.style).toEqual({ fontWeight: 'bold' });
      expect(element.props.children).toContain('Dupont Thomas');
      expect(findImage(element.props.children)?.props).toMatchObject({
        src: `data:image/png;base64,${AVATAR_BASE64}`,
      });
    });

    it('exports the name only without canvas', () => {
      mockCanvas(false);

      const element = inlineContentMappingUserMentionPDF(
        mention,
        exporter,
      ) as unknown as React.ReactElement<{ children: React.ReactNode }>;

      expect(element.props.children).toContain('Dupont Thomas');
      expect(findImage(element.props.children)).toBeUndefined();
    });

    it('exports nothing when the user is missing', () => {
      const element = inlineContentMappingUserMentionPDF(
        emptyMention,
        exporter,
      ) as unknown as React.ReactElement<{ children?: unknown }>;

      expect(element.props.children).toBeUndefined();
    });
  });
});
