import _ from 'lodash';
import { create } from 'zustand';

import { DocsBlockNoteEditor, HeadingBlock } from '../types';

const recursiveTextContent = (content: HeadingBlock['content']): string => {
  if (!content) {
    return '';
  }

  return content.reduce((acc, content) => {
    if (content.type === 'text') {
      return acc + content.text;
    } else if (content.type === 'link') {
      return acc + recursiveTextContent(content.content);
    }

    return acc;
  }, '');
};

export interface UseHeadingStore {
  headings: HeadingBlock[];
  setHeadings: (editor: DocsBlockNoteEditor) => void;
  resetHeadings: () => void;
}

export const useHeadingStore = create<UseHeadingStore>((set, get) => ({
  headings: [],
  setHeadings: (editor) => {
    const headingBlocks = editor?.document
      .filter((block) => block.type === 'heading')
      .map((block) => ({
        ...block,
        contentText: recursiveTextContent(
          block.content as unknown as HeadingBlock['content'],
        ),
      })) as unknown as HeadingBlock[];

    if (!_.isEqual(get().headings, headingBlocks)) {
      set(() => ({ headings: headingBlocks }));
    }
  },
  resetHeadings: () => set(() => ({ headings: [] })),
}));
