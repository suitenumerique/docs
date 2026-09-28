import type { Block } from '@blocknote/core/blocks';

import type {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '@/docs/doc-editor/types';

export type PresenterBlock = Block<
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema
>;

export type PresenterTitleSlide = {
  kind: 'title';
  showDividerHint: boolean;
  title: string;
};

export type PresenterContentSlide = {
  blocks: PresenterBlock[];
  kind: 'content';
};

export type PresenterSlideData = PresenterTitleSlide | PresenterContentSlide;
