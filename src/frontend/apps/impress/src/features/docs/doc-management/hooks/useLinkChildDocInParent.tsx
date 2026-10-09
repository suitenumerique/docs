import { useCallback } from 'react';

import { useEditorStore } from '@/docs/doc-editor/stores/useEditorStore';

import { useDocStore, useProviderStore } from '../stores';

const SYNC_TIMEOUT_MS = 3000;

/**
 * Resolves once the collaboration provider is synced, so an edit made right
 * before navigating away reaches the server instead of dying with the editor.
 */
const waitForProviderSync = () =>
  new Promise<void>((resolve) => {
    if (useProviderStore.getState().isSynced) {
      resolve();
      return;
    }

    const done = () => {
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    };
    const timeout = setTimeout(done, SYNC_TIMEOUT_MS);
    const unsubscribe = useProviderStore.subscribe((state) => {
      if (state.isSynced) {
        done();
      }
    });
  });

/**
 * Resolves once the edit just made has been sent to the collaboration server.
 *
 * The socket sends an update as soon as it is made. The http fallback only
 * publishes it on its next round, and its `synced` flag stays true from its
 * first one, so `isSynced` says nothing about this edit: a round is forced.
 */
const waitForPublish = async () => {
  const { provider, httpProvider } = useProviderStore.getState();

  if (provider?.wsconnected) {
    return;
  }

  if (!httpProvider?.shouldConnect) {
    return waitForProviderSync();
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    // a failed round keeps the edit queued for the next one
    httpProvider.sync().catch(() => undefined),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, SYNC_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timeout);
};

/**
 * Inserts an interlink to a freshly created sub-doc in its parent, so the
 * parent content references its children. Only possible when the parent is
 * the doc currently open in an editable editor. Await it before navigating
 * to the sub-doc.
 */
export const useLinkChildDocInParent = () => {
  const { editor } = useEditorStore();
  const { currentDoc } = useDocStore();

  return useCallback(
    async (parentId: string, childId: string, position: 'cursor' | 'end') => {
      if (!editor?.isEditable || currentDoc?.id !== parentId) {
        return;
      }

      const link = {
        type: 'interlinkingLinkInline',
        props: { docId: childId },
      } as const;

      if (position === 'cursor') {
        editor.insertInlineContent([link, ' ']);
      } else {
        const lastBlock = editor.document[editor.document.length - 1];
        const isEmptyParagraph =
          lastBlock?.type === 'paragraph' &&
          Array.isArray(lastBlock.content) &&
          lastBlock.content.length === 0;

        if (isEmptyParagraph) {
          editor.updateBlock(lastBlock, { content: [link] });
        } else {
          editor.insertBlocks(
            [{ type: 'paragraph', content: [link] }],
            lastBlock,
            'after',
          );
        }
      }

      await waitForPublish();
    },
    [editor, currentDoc?.id],
  );
};
