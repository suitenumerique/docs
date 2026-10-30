import { Loader } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { css } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import AnchorIcon from '@/assets/icons/ui-kit/hashtag.svg';
import { Box, Text } from '@/components';
import SelectedPageIcon from '@/docs/doc-editor/assets/doc-selected.svg';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import {
  KEY_DOC,
  getEmojiAndTitle,
  useDoc,
  useDocStore,
  useTrans,
} from '@/docs/doc-management/';

import { getBlockAnchorLabel } from './getBlockAnchorLabel';

const BLOCK_LABEL_REFRESH_DELAY = 2000;

interface LinkSelectedProps {
  docId: string;
  blockId?: string;
  isEditable: boolean;
  editor?: DocsBlockNoteEditor;
}

/**
 * The text of the linked block, kept up to date while the editor changes.
 * Only for an anchor in the current doc: its blocks are the ones of the editor.
 */
const useSameDocBlockLabel = (
  editor: DocsBlockNoteEditor | undefined,
  isSameDoc: boolean,
  blockId?: string,
) => {
  const getLabel = useCallback(
    () =>
      editor && isSameDoc && blockId
        ? getBlockAnchorLabel(editor, blockId)
        : null,
    [editor, isSameDoc, blockId],
  );
  const [label, setLabel] = useState(getLabel);
  // The lookup the label comes from: the mount does not walk the doc twice.
  const labelSourceRef = useRef(getLabel);
  // Looking for the block walks the doc: it waits for the edits to settle.
  const refreshLabel = useDebouncedCallback(
    () => setLabel(getLabel()),
    BLOCK_LABEL_REFRESH_DELAY,
  );

  // Recomputes the label when the link changes, and refreshes it after the
  // edits of the doc.
  useEffect(() => {
    if (labelSourceRef.current !== getLabel) {
      labelSourceRef.current = getLabel;
      setLabel(getLabel());
    }

    if (!editor || !isSameDoc || !blockId) {
      return;
    }

    const unsubscribe = editor.onChange(() => refreshLabel());

    return () => {
      unsubscribe();
      refreshLabel.cancel();
    };
  }, [editor, isSameDoc, blockId, getLabel, refreshLabel]);

  return label;
};

export const LinkSelected = ({ docId, blockId, editor }: LinkSelectedProps) => {
  const { data: doc, isLoading } = useDoc(
    { id: docId },
    {
      queryKey: [KEY_DOC, { id: docId }],
      refetchOnWindowFocus: (query) => query.state.error?.status !== 403,
    },
  );
  const { untitledDocument } = useTrans();
  const href = `/docs/${docId}/${blockId ? `#${blockId}` : ''}`;
  const visualHref = `/${docId}/`;
  const { currentDoc } = useDocStore();
  const blockLabel = useSameDocBlockLabel(
    editor,
    currentDoc?.id === docId,
    blockId,
  );
  const label = doc ? doc.title || untitledDocument : visualHref;
  const isHrefFallback = !isLoading && !doc && !blockLabel;
  // The text of a block is not a title: its emoji stays in the text, and the
  // icon is the one of an anchor.
  const { emoji, titleWithoutEmoji } = blockLabel
    ? { emoji: undefined, titleWithoutEmoji: blockLabel }
    : getEmojiAndTitle(label);
  const DefaultIcon = blockLabel ? AnchorIcon : SelectedPageIcon;
  const isDeletedDoc = !!currentDoc?.deleted_at;
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();

    if (isDeletedDoc) {
      return;
    }

    // If ctrl or command is pressed, it opens a new tab. If shift is pressed, it opens a new window
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      window.open(href, '_blank');
      return;
    }
    void router.push(href);
  };

  // This triggers on middle-mouse click
  const handleAuxClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (e.button !== 1 || isDeletedDoc) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    window.open(href, '_blank');
  };

  /**
   * A link is activated with Enter only, Space is a button behaviour and stays
   * available to the editor.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key !== 'Enter' || isDeletedDoc) {
      return;
    }
    e.preventDefault();
    void router.push(href);
  };

  return (
    <Box
      as="span"
      role="link"
      tabIndex={isDeletedDoc ? -1 : 0}
      aria-disabled={isDeletedDoc || undefined}
      className="--docs--interlinking-link-inline-content"
      data-href={href}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      onKeyDown={handleKeyDown}
      draggable="false"
      $height="28px"
      $display="inline"
      $css={css`
        padding: 0.1rem 0;
        border-radius: 4px;
        cursor: pointer;
        & svg {
          position: relative;
          top: 2px;
          margin-right: 0.2rem;
        }
        &:hover {
          background-color: var(
            --c--contextuals--background--semantic--contextual--primary
          );
          box-shadow:
            -0.25em 0 0
              var(--c--contextuals--background--semantic--contextual--primary),
            0.25em 0 0
              var(--c--contextuals--background--semantic--contextual--primary);
        }
        transition:
          background-color var(--c--globals--transitions--duration)
            var(--c--globals--transitions--ease-out),
          box-shadow var(--c--globals--transitions--duration)
            var(--c--globals--transitions--ease-out);

        .--docs--doc-deleted & {
          pointer-events: none;
        }
      `}
    >
      {emoji ? (
        <Text $size="16px">{emoji}</Text>
      ) : (
        <DefaultIcon
          width={blockLabel ? 16 : 11.5}
          color="var(--c--contextuals--content--semantic--brand--tertiary)"
        />
      )}
      <Text
        $weight="500"
        spellCheck="false"
        $size={isHrefFallback ? 'sm' : 'md'}
        $display="inline"
        $position="relative"
        $css={css`
          margin-left: 2px;
          text-decoration: underline;
          text-decoration-color: var(
            --c--contextuals--border--semantic--neutral--tertiary
          );
          text-underline-offset: 0.2em;
        `}
      >
        {isLoading && !blockLabel ? (
          <Box
            as="span"
            $display="inline-flex"
            $css={css`
              vertical-align: middle;
              & .c__loader--small {
                width: 14px;
                height: 14px;
              }
            `}
          >
            <Loader size="small" />
          </Box>
        ) : (
          titleWithoutEmoji
        )}
      </Text>
    </Box>
  );
};
