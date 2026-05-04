import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { blockNoteSchema } from '@/docs/doc-editor/components/BlockNoteEditor';
import { cssEditor } from '@/docs/doc-editor/styles';

interface PresenterSlideProps {
  blocks: unknown[];
  ariaLabel?: string;
}

const slideCss = css`
  ${cssEditor};
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem;
  /* Scale the slide content so it reads larger than the regular editor.
   * Using \`zoom\` (not \`transform: scale\`) so parent scroll, hit testing
   * and overflow detection account for the upscaled size. */
  zoom: 1.3;
  /* Hide editor chrome that may leak through despite editable={false} */
  .bn-side-menu,
  .bn-formatting-toolbar,
  .bn-slash-menu {
    display: none !important;
  }
`;

export const PresenterSlide = ({ blocks, ariaLabel }: PresenterSlideProps) => {
  const { t } = useTranslation();
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

  return (
    <Box
      $css={slideCss}
      role="group"
      className="titi-presenter-slide"
      aria-label={ariaLabel ?? t('Presenter slide')}
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
