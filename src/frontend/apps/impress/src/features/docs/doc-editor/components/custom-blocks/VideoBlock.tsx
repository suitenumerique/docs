import {
  BlockConfig,
  BlockNoDefaults,
  BlockNoteEditor,
  InlineContentSchema,
  StyleSchema,
  defaultProps,
} from '@blocknote/core';
import {
  AddFileButton,
  ResizableFileBlockWrapper,
  createReactBlockSpec,
} from '@blocknote/react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box } from '@/components';
import { parseEmbedUrl } from '@/utils/embed';
import { isSafeUrl } from '@/utils/url';

import Warning from '../../assets/warning.svg';

const VideoBlockStyle = createGlobalStyle`
  .bn-block-content[data-content-type="video"] .bn-file-block-content-wrapper {
    width: fit-content;
  }
  .bn-block-content[data-content-type="video"] .bn-file-block-content-wrapper[style*="fit-content"] {
    width: 100% !important;
  }
`;

type FileBlockEditor = Parameters<typeof AddFileButton>[0]['editor'];
type FileBlockBlock = Parameters<typeof AddFileButton>[0]['block'];

type CreateVideoBlockConfig = BlockConfig<
  'video',
  {
    textAlignment: typeof defaultProps.textAlignment;
    backgroundColor: typeof defaultProps.backgroundColor;
    name: { default: '' };
    url: { default: '' };
    caption: { default: '' };
    showPreview: { default: true };
    previewWidth: { default: undefined; type: 'number' };
  },
  'none'
>;

interface VideoBlockComponentProps {
  block: BlockNoDefaults<
    Record<'video', CreateVideoBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
  editor: BlockNoteEditor<
    Record<'video', CreateVideoBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
}

const VideoBlockComponent = ({ editor, block }: VideoBlockComponentProps) => {
  const { t } = useTranslation();
  const url = block.props.url;

  // Only flag a URL as invalid once one has actually been entered. An empty
  // URL is the freshly-inserted state and should fall through to the wrapper
  // so BlockNote shows its built-in file/URL/embed picker.
  if (url && !isSafeUrl(url)) {
    return (
      <Box
        $direction="row"
        $gap="0.5rem"
        $width="inherit"
        $css="pointer-events: none;"
        contentEditable={false}
        draggable={false}
      >
        <Warning />
        {t('Invalid or missing video URL.')}
      </Box>
    );
  }

  const { kind, src } = parseEmbedUrl(url);

  return (
    <>
      <VideoBlockStyle />
      <ResizableFileBlockWrapper
        block={block as unknown as FileBlockBlock}
        editor={editor as unknown as FileBlockEditor}
      >
        {url &&
          (kind === 'iframe' ? (
            <Box
              as="iframe"
              className="bn-visual-media"
              $width="100%"
              $css="aspect-ratio: 16 / 9; border: 0;"
              src={src}
              // Sandbox + allow attributes match what major embed providers
              // (YouTube, Vimeo, Loom) require to play inline. `allow-popups`
              // is needed for "Watch on YouTube" links opening in a new tab.
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              title={block.props.name || t('Embedded video')}
              contentEditable={false}
              draggable={false}
            />
          ) : (
            <Box
              as="video"
              className="bn-visual-media"
              $width="100%"
              src={src}
              controls
              aria-label={block.props.name || t('Video')}
              contentEditable={false}
              draggable={false}
            />
          ))}
      </ResizableFileBlockWrapper>
    </>
  );
};

export const VideoBlock = createReactBlockSpec(
  {
    type: 'video',
    content: 'none',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      backgroundColor: defaultProps.backgroundColor,
      name: { default: '' as const },
      url: { default: '' as const },
      caption: { default: '' as const },
      showPreview: { default: true },
      previewWidth: { default: undefined, type: 'number' },
    },
  },
  {
    meta: {
      fileBlockAccept: ['video/*'],
    },
    render: (props) => <VideoBlockComponent {...props} />,
  },
);
