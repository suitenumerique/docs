import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorStore } from '@/docs/doc-editor/stores/useEditorStore';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';

import { useDocStore, useProviderStore } from '../../stores';
import { Doc } from '../../types';
import { useLinkChildDocInParent } from '../useLinkChildDocInParent';

const link = {
  type: 'interlinkingLinkInline',
  props: { docId: 'child-id' },
};

const mockEditor = (document: unknown[], isEditable = true) => {
  const editor = {
    isEditable,
    document,
    insertInlineContent: vi.fn(),
    insertBlocks: vi.fn(),
    updateBlock: vi.fn(),
  };
  useEditorStore.setState({
    editor: editor as unknown as DocsBlockNoteEditor,
  });
  return editor;
};

describe('useLinkChildDocInParent', () => {
  beforeEach(() => {
    useDocStore.setState({ currentDoc: { id: 'parent-id' } as Doc });
    useProviderStore.setState({ isSynced: true });
  });

  it('inserts the link at the cursor', async () => {
    const editor = mockEditor([]);
    const { result } = renderHook(() => useLinkChildDocInParent());

    await result.current('parent-id', 'child-id', 'cursor');

    expect(editor.insertInlineContent).toHaveBeenCalledWith([link, ' ']);
  });

  it('fills the trailing empty paragraph when appending', async () => {
    const lastBlock = { id: 'b2', type: 'paragraph', content: [] };
    const editor = mockEditor([
      { id: 'b1', type: 'paragraph', content: [{ type: 'text' }] },
      lastBlock,
    ]);
    const { result } = renderHook(() => useLinkChildDocInParent());

    await result.current('parent-id', 'child-id', 'end');

    expect(editor.updateBlock).toHaveBeenCalledWith(lastBlock, {
      content: [link],
    });
    expect(editor.insertBlocks).not.toHaveBeenCalled();
  });

  it('adds a paragraph after the last block when it is not empty', async () => {
    const lastBlock = { id: 'b1', type: 'heading', content: [] };
    const editor = mockEditor([lastBlock]);
    const { result } = renderHook(() => useLinkChildDocInParent());

    await result.current('parent-id', 'child-id', 'end');

    expect(editor.insertBlocks).toHaveBeenCalledWith(
      [{ type: 'paragraph', content: [link] }],
      lastBlock,
      'after',
    );
  });

  it('does nothing when the parent is not the open doc', async () => {
    const editor = mockEditor([]);
    const { result } = renderHook(() => useLinkChildDocInParent());

    await result.current('other-id', 'child-id', 'cursor');

    expect(editor.insertInlineContent).not.toHaveBeenCalled();
  });

  it('waits for the provider to sync before resolving', async () => {
    vi.useFakeTimers();
    useProviderStore.setState({ isSynced: false });
    mockEditor([]);
    const { result } = renderHook(() => useLinkChildDocInParent());

    let resolved = false;
    void result.current('parent-id', 'child-id', 'cursor').then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(false);

    useProviderStore.setState({ isSynced: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });

  it('does nothing when the editor is read-only', async () => {
    const editor = mockEditor([], false);
    const { result } = renderHook(() => useLinkChildDocInParent());

    await result.current('parent-id', 'child-id', 'cursor');

    expect(editor.insertInlineContent).not.toHaveBeenCalled();
  });
});
