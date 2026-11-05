import { Loader } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/compat/router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import AnchorIcon from '@/assets/icons/ui-kit/hashtag.svg';
import { Box, Text } from '@/components';
import SelectedPageIcon from '@/docs/doc-editor/assets/doc-selected.svg';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import {
  Doc,
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
  /** Skips fetching the doc when the caller already has it */
  doc?: Doc;
  editor?: DocsBlockNoteEditor;
}

/**
 * The text of the linked block, kept up to date while the editor changes.
 * Only for an anchor in the current doc: its blocks are the ones of the editor.
 * null: not an anchor of this doc, nothing to show,
 * undefined: the block does not exist anymore.
 */
const useSameDocBlockLabel = (
  editor: DocsBlockNoteEditor | undefined,
  isSameDoc: boolean,
  blockId?: string,
) => {
  const { t } = useTranslation();
  const getLabel = useCallback(
    () =>
      editor && isSameDoc && blockId
        ? getBlockAnchorLabel(editor, blockId, t)
        : null,
    [editor, isSameDoc, blockId, t],
  );
  // The lookup the label comes from, kept with it: a label of another
  // lookup is never shown.
  const [current, setCurrent] = useState(() => ({
    source: getLabel,
    label: getLabel(),
  }));
  // A new link target is applied in the very render that commits it (not in
  // an effect), or a render with the old label would be painted first.
  if (current.source !== getLabel) {
    setCurrent({ source: getLabel, label: getLabel() });
  }
  // Looking for the block walks the doc: it waits for the edits to settle.
  const refreshLabel = useDebouncedCallback(
    () => setCurrent({ source: getLabel, label: getLabel() }),
    BLOCK_LABEL_REFRESH_DELAY,
  );

  // Refreshes the label after the edits of the doc.
  useEffect(() => {
    if (!editor || !isSameDoc || !blockId) {
      return;
    }

    const unsubscribe = editor.onChange(() => refreshLabel());

    return () => {
      unsubscribe();
      refreshLabel.cancel();
    };
  }, [editor, isSameDoc, blockId, getLabel, refreshLabel]);

  return current.label;
};

export const LinkSelected = ({
  docId,
  blockId,
  doc: preloadedDoc,
  editor,
}: LinkSelectedProps) => {
  const {
    data: fetchedDoc,
    isLoading,
    error,
  } = useDoc(
    { id: docId },
    {
      queryKey: [KEY_DOC, { id: docId }],
      refetchOnWindowFocus: (query) => query.state.error?.status !== 403,
      enabled: !preloadedDoc,
    },
  );
  const doc = preloadedDoc ?? fetchedDoc;
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const href = `/docs/${docId}/${blockId ? `#${blockId}` : ''}`;
  const visualHref = `/${docId}/`;
  const { currentDoc } = useDocStore();
  const blockLabel = useSameDocBlockLabel(
    editor,
    currentDoc?.id === docId,
    blockId,
  );
  // The slug of a doc is shown only when nothing more is known about it
  const isNoAccess = !doc && error?.status === 403;
  const label = doc
    ? doc.title || untitledDocument
    : isNoAccess
      ? t('No access')
      : visualHref;
  const isBlockAnchor = blockLabel !== null;
  const isHrefFallback = !isLoading && !doc && !isNoAccess && !isBlockAnchor;
  // The text of a block is not a title: its emoji stays in the text, and the
  // icon is the one of an anchor. A deleted block has no text left.
  const { emoji, titleWithoutEmoji } = isBlockAnchor
    ? {
        emoji: undefined,
        titleWithoutEmoji: blockLabel?.text ?? t('Removed or not found'),
      }
    : getEmojiAndTitle(label);
  const DefaultIcon = isBlockAnchor ? AnchorIcon : SelectedPageIcon;
  // Italic tells a text made up by Docs from what the user wrote
  const isMadeUpText = isBlockAnchor
    ? !blockLabel || blockLabel.isFallback
    : isNoAccess;
  const isDeletedDoc = !!currentDoc?.deleted_at;
  // The compat router is null outside of the Next.js router context, e.g. in
  // the slides print root, where nothing can be clicked.
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
    void router?.push(href);
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
    void router?.push(href);
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
      <Text $display="inline-block" $width="1.25rem" $textAlign="center">
        {emoji ? (
          <Text $size="16px">{emoji}</Text>
        ) : (
          <DefaultIcon
            width={isBlockAnchor ? 16 : 11.5}
            color={
              isBlockAnchor
                ? 'var(--c--contextuals--content--semantic--neutral--tertiary)'
                : 'var(--c--contextuals--content--semantic--brand--tertiary)'
            }
          />
        )}
      </Text>
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
          ${isMadeUpText ? 'font-style: italic;' : ''}
        `}
      >
        {isLoading && !isBlockAnchor ? (
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
