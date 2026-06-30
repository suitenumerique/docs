import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { CSSProperties, Ref, useEffect, useRef } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { blockNoteSchema } from '@/docs/doc-editor/components/BlockNoteEditor';

import type { PresenterBlock } from '../types';

interface PresenterSlideContentProps {
  blocks: PresenterBlock[];
  className?: string;
  innerRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
}

const slideContentCss = css`
  .bn-side-menu,
  .bn-formatting-toolbar,
  .bn-slash-menu {
    display: none !important;
  }
`;

const setRefValue = (
  ref: Ref<HTMLDivElement> | undefined,
  node: HTMLDivElement | null,
) => {
  if (!ref) {
    return;
  }

  if (typeof ref === 'function') {
    ref(node);
    return;
  }

  (ref as { current: HTMLDivElement | null }).current = node;
};

export const PresenterSlideContent = ({
  blocks,
  className,
  innerRef,
  style,
}: PresenterSlideContentProps) => {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const editor = useCreateBlockNote({
    initialContent:
      // BlockNote rejects an empty initialContent array — fall back to one empty paragraph.
      blocks.length > 0
        ? (blocks as NonNullable<
            Parameters<typeof useCreateBlockNote>[0]
          >['initialContent'])
        : undefined,
    schema: blockNoteSchema,
  });

  // Even with `editable={false}`, BlockNote/ProseMirror currently still renders
  // the editor node with `role="textbox"` and `contenteditable`. For presenter
  // slides that is wrong - the content is presentation, not an editable field -
  // and it pollutes the accessibility tree. Strip those, but keep the content
  // tabbable so keyboard users can reach and scroll long slides. (Observed
  // BlockNote behaviour, not a guarantee; revisit on upgrades.)
  useEffect(() => {
    const pm = contentRef.current?.querySelector('.ProseMirror');
    if (pm) {
      pm.removeAttribute('role');
      pm.removeAttribute('contenteditable');
      pm.setAttribute('tabindex', '0');
    }
  }, []);

  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        contentRef.current = node;
        setRefValue(innerRef, node);
      }}
      className={className}
      $css={slideContentCss}
      style={style}
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
  );
};
