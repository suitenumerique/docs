import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { AppWrapper } from '@/tests/utils';

const mockCreateChildDoc = vi.fn();
const mockCurrentDoc = { id: 'current-doc-id' };

vi.mock('@/docs/doc-management', async () => {
  const actual = await vi.importActual('@/docs/doc-management');
  return {
    ...actual,
    useDocStore: () => ({ currentDoc: mockCurrentDoc }),
    useCreateChildDocTree: () => mockCreateChildDoc,
  };
});

import {
  getInterlinkinghMenuItems,
  useGetInterlinkingMenuItems,
} from '../InterlinkingLinkInlineContent';

const t = ((key: string) => key) as unknown as Parameters<
  typeof getInterlinkinghMenuItems
>[1];

describe('getInterlinkinghMenuItems', () => {
  it('inserts an interlink inline content when the "link-doc" item is clicked', () => {
    const insertInlineContent = vi.fn();
    const editor = { insertInlineContent } as unknown as DocsBlockNoteEditor;
    const createPage = vi.fn();

    const items = getInterlinkinghMenuItems(editor, t, 'Links', createPage);
    const linkDocItem = items.find((item) => item.key === 'link-doc');

    linkDocItem?.onItemClick();

    expect(insertInlineContent).toHaveBeenCalledWith([
      {
        type: 'interlinkingLinkInline',
        props: { trigger: '/' },
      },
    ]);
    expect(createPage).not.toHaveBeenCalled();
  });

  it('delegates to createPage when the "new-sub-doc" item is clicked', () => {
    const insertInlineContent = vi.fn();
    const editor = { insertInlineContent } as unknown as DocsBlockNoteEditor;
    const createPage = vi.fn();

    const items = getInterlinkinghMenuItems(editor, t, 'Links', createPage);
    const newSubDocItem = items.find((item) => item.key === 'new-sub-doc');

    newSubDocItem?.onItemClick();

    expect(createPage).toHaveBeenCalledTimes(1);
    expect(insertInlineContent).not.toHaveBeenCalled();
  });

  it('tags both items with the given group and searchable aliases', () => {
    const editor = {
      insertInlineContent: vi.fn(),
    } as unknown as DocsBlockNoteEditor;

    const items = getInterlinkinghMenuItems(editor, t, 'Links', vi.fn());

    expect(items).toHaveLength(2);
    items.forEach((item) => {
      expect(item.group).toBe('Links');
      expect(item.aliases.length).toBeGreaterThan(0);
    });
  });
});

describe('useGetInterlinkingMenuItems', () => {
  it('builds menu items bound to the current doc as parent', () => {
    const { result } = renderHook(() => useGetInterlinkingMenuItems(), {
      wrapper: AppWrapper,
    });

    const insertInlineContent = vi.fn();
    const editor = { insertInlineContent } as unknown as DocsBlockNoteEditor;

    const items = result.current(editor, t);
    const newSubDocItem = items.find((item) => item.key === 'new-sub-doc');

    newSubDocItem?.onItemClick();

    expect(mockCreateChildDoc).toHaveBeenCalledTimes(1);
  });
});
