import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { RefObject, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { blockNoteSchema } from '@/docs/doc-editor/components/BlockNoteEditor';
import { DocsEditorStyle } from '@/docs/doc-editor/styles';

import { DESIGN_WIDTH, S_MAX, S_MIN } from '../constants';
import { useFitScale } from '../hooks/useFitScale';

interface PresenterSlideProps {
  blocks: unknown[];
  frameRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  ariaLabel?: string;
}

const cardCss = css`
  min-height: 0;
  padding: 2.5rem 3.5rem;
  .bn-side-menu,
  .bn-formatting-toolbar,
  .bn-slash-menu {
    display: none !important;
  }
  .bn-container,
  .bn-root .bn-editor {
    height: auto !important;
    min-height: 0 !important;
  }
`;

export const PresenterSlide = ({
  blocks,
  frameRef,
  isFullscreen,
  ariaLabel,
}: PresenterSlideProps) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const { scale, naturalHeight, remeasure } = useFitScale(frameRef, cardRef, {
    designWidth: DESIGN_WIDTH,
    minScale: S_MIN,
    maxScale: S_MAX,
    viewportEpoch: isFullscreen,
  });

  const editor = useCreateBlockNote({
    initialContent:
      blocks.length > 0
        ? (blocks as NonNullable<
            Parameters<typeof useCreateBlockNote>[0]
          >['initialContent'])
        : undefined,
    schema: blockNoteSchema,
  });

  // BlockNote inserts ProseMirror in a useEffect that fires after
  // useFitScale's useLayoutEffect — its onMount is the deterministic signal
  // that the editor DOM is in place, so we wait for it before kicking off
  // the first fit pass. Two rAFs after let styled-components rules and the
  // surrounding flex layout settle before the final measurement.
  useEffect(() => {
    let rafId1 = 0;
    let rafId2 = 0;
    const unsubscribe = editor.onMount(() => {
      remeasure();
      if (typeof requestAnimationFrame !== 'undefined') {
        rafId1 = requestAnimationFrame(() => {
          remeasure();
          rafId2 = requestAnimationFrame(remeasure);
        });
      }
    });
    return () => {
      unsubscribe();
      if (rafId1) {
        cancelAnimationFrame(rafId1);
      }
      if (rafId2) {
        cancelAnimationFrame(rafId2);
      }
    };
  }, [editor, remeasure]);

  const hasMeasuredHeight = naturalHeight > 0;

  return (
    <>
      <DocsEditorStyle />
      <Box
        style={{
          width: hasMeasuredHeight ? DESIGN_WIDTH * scale : 'auto',
          height: hasMeasuredHeight ? naturalHeight * scale : 'auto',
          margin: 'auto',
        }}
        role="group"
        aria-label={ariaLabel ?? t('Presenter slide')}
      >
        <Box
          ref={cardRef}
          $css={cardCss}
          style={{
            width: DESIGN_WIDTH,
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
          }}
        >
          <BlockNoteView
            editor={editor}
            editable={false}
            theme="light"
            formattingToolbar={false}
            slashMenu={false}
            comments={false}
          />
        </Box>
      </Box>
    </>
  );
};
