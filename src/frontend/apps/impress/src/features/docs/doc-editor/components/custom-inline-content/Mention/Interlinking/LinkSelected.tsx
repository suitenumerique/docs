import { Loader } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import SelectedPageIcon from '@/docs/doc-editor/assets/doc-selected.svg';
import {
  KEY_DOC,
  getEmojiAndTitle,
  useDoc,
  useDocStore,
  useTrans,
} from '@/docs/doc-management/';

interface LinkSelectedProps {
  docId: string;
  blockId?: string;
  isEditable: boolean;
}
export const LinkSelected = ({ docId, blockId }: LinkSelectedProps) => {
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
  const label = doc ? doc.title || untitledDocument : visualHref;
  const isHrefFallback = !isLoading && !doc;
  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(label);
  const { currentDoc } = useDocStore();
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
      $css={css`
        display: inline;
        padding: 0.1rem 0.4rem;
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
        }
        transition: background-color var(--c--globals--transitions--duration)
          var(--c--globals--transitions--ease-out);

        .--docs--doc-deleted & {
          pointer-events: none;
        }
      `}
    >
      {emoji ? (
        <Text $size="16px">{emoji}</Text>
      ) : (
        <SelectedPageIcon
          width={11.5}
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
        {isLoading ? (
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
