import {
  BlockNoDefaults,
  BlockNoteEditor,
  InlineContentSchema,
  StyleSchema,
  createVideoBlockConfig,
  videoParse,
} from '@blocknote/core';
import {
  ResizableFileBlockWrapper,
  createReactBlockSpec,
} from '@blocknote/react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';

import { useDecryptMedia } from '../../hook';
import { EncryptedMediaPlaceholder } from '../EncryptedMediaPlaceholder';

type VideoBlockConfig = ReturnType<typeof createVideoBlockConfig>;

interface VideoBlockComponentProps {
  block: BlockNoDefaults<
    Record<'video', VideoBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
  contentRef: (node: HTMLElement | null) => void;
  editor: BlockNoteEditor<
    Record<'video', VideoBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
}

const VideoBlockComponent = ({
  editor,
  block,
  ...rest
}: VideoBlockComponentProps) => {
  const { t } = useTranslation();
  const {
    showPlaceholder,
    showMedia,
    isLoading,
    hasError,
    decrypt,
    resolvedUrl,
  } = useDecryptMedia(block.props.url);

  return (
    <ResizableFileBlockWrapper
      {...({ editor, block, ...rest } as any)}
      buttonIcon={
        <Icon iconName="videocam" $size="24px" $css="line-height: normal;" />
      }
    >
      {showPlaceholder && (
        <EncryptedMediaPlaceholder
          label={t('Click to decrypt and play video')}
          errorLabel={t('Failed to decrypt video file.')}
          minHeight="300px"
          isLoading={isLoading}
          hasError={hasError}
          onDecrypt={() => void decrypt()}
        />
      )}
      {showMedia && (
        <video
          className="bn-visual-media"
          src={resolvedUrl || block.props.url}
          controls
          contentEditable={false}
          draggable={false}
        />
      )}
    </ResizableFileBlockWrapper>
  );
};

const VideoToExternalHTML = ({
  block,
}: {
  block: BlockNoDefaults<
    Record<'video', VideoBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
}) => {
  if (!block.props.url) {
    return <p>Add video</p>;
  }

  return <video src={block.props.url} controls />;
};

export const VideoBlock = createReactBlockSpec(
  createVideoBlockConfig,
  (config) => ({
    meta: {
      fileBlockAccept: ['video/*'],
    },
    render: (props) => <VideoBlockComponent {...(props as any)} />,
    parse: videoParse(config),
    toExternalHTML: (props) => <VideoToExternalHTML {...(props as any)} />,
    runsBefore: ['file'],
  }),
);
