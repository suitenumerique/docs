import {
  BlockNoDefaults,
  BlockNoteEditor,
  InlineContentSchema,
  StyleSchema,
  audioParse,
  createAudioBlockConfig,
} from '@blocknote/core';
import { FileBlockWrapper, createReactBlockSpec } from '@blocknote/react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';

import { useDecryptMedia } from '../../hook';
import { EncryptedMediaPlaceholder } from '../EncryptedMediaPlaceholder';

type AudioBlockConfig = ReturnType<typeof createAudioBlockConfig>;

interface AudioBlockComponentProps {
  block: BlockNoDefaults<
    Record<'audio', AudioBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
  contentRef: (node: HTMLElement | null) => void;
  editor: BlockNoteEditor<
    Record<'audio', AudioBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
}

const AudioBlockComponent = ({
  editor,
  block,
  ...rest
}: AudioBlockComponentProps) => {
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
    <FileBlockWrapper
      {...({ editor, block, ...rest } as any)}
      buttonIcon={
        <Icon iconName="audiotrack" $size="24px" $css="line-height: normal;" />
      }
    >
      {showPlaceholder && (
        <EncryptedMediaPlaceholder
          label={t('Click to decrypt and play audio')}
          errorLabel={t('Failed to decrypt audio file.')}
          minHeight="80px"
          isLoading={isLoading}
          hasError={hasError}
          onDecrypt={() => void decrypt()}
        />
      )}
      {showMedia && (
        <audio
          className="bn-audio"
          src={resolvedUrl || block.props.url}
          controls
          contentEditable={false}
          draggable={false}
        />
      )}
    </FileBlockWrapper>
  );
};

const AudioToExternalHTML = ({
  block,
}: {
  block: BlockNoDefaults<
    Record<'audio', AudioBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
}) => {
  if (!block.props.url) {
    return <p>Add audio</p>;
  }

  return <audio src={block.props.url} controls />;
};

export const AudioBlock = createReactBlockSpec(
  createAudioBlockConfig,
  (config) => ({
    meta: {
      fileBlockAccept: ['audio/*'],
    },
    render: (props) => <AudioBlockComponent {...(props as any)} />,
    parse: audioParse(config),
    toExternalHTML: (props) => <AudioToExternalHTML {...(props as any)} />,
    runsBefore: ['file'],
  }),
);
