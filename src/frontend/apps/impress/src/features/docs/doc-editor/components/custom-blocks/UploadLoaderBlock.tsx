import {
  BlockConfig,
  BlockNoDefaults,
  BlockNoteEditor,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { t } from 'i18next';
import { useEffect } from 'react';

import { Box, Text } from '@/components';
import { useMediaUrl } from '@/core';

import { loopCheckDocMediaStatus } from '../../api';
import Loader from '../../assets/loader.svg';
import Warning from '../../assets/warning.svg';

type UploadLoaderPropSchema = {
  readonly information: { readonly default: '' };
  readonly type: {
    readonly default: 'loading';
    readonly values: readonly ['loading', 'warning'];
  };
  readonly blockUploadName: { readonly default: '' };
  readonly blockUploadShowPreview: { readonly default: true };
  readonly blockUploadType: {
    readonly default: '';
  };
  readonly blockUploadUrl: { readonly default: '' };
};

type UploadLoaderBlockConfig = BlockConfig<
  'uploadLoader',
  UploadLoaderPropSchema,
  'none'
>;

type UploadLoaderBlockType = BlockNoDefaults<
  Record<'uploadLoader', UploadLoaderBlockConfig>,
  InlineContentSchema,
  StyleSchema
>;

type UploadLoaderEditor = BlockNoteEditor<
  Record<'uploadLoader', UploadLoaderBlockConfig>,
  InlineContentSchema,
  StyleSchema
>;

interface UploadLoaderBlockComponentProps {
  block: UploadLoaderBlockType;
  editor: UploadLoaderEditor;
  contentRef: (node: HTMLElement | null) => void;
}

const UploadLoaderBlockComponent = ({
  block,
  editor,
}: UploadLoaderBlockComponentProps) => {
  const mediaUrl = useMediaUrl();
  const isEditable = editor.isEditable;

  useEffect(() => {
    const shouldCheckStatus =
      block.props.blockUploadUrl &&
      block.props.type === 'loading' &&
      isEditable;

    if (!shouldCheckStatus) {
      return;
    }

    const url = block.props.blockUploadUrl;

    loopCheckDocMediaStatus(url)
      .then((response) => {
        // Add random delay to reduce collision probability during collaboration
        const randomDelay = Math.random() * 800;
        setTimeout(() => {
          // Replace the loading block with the resource block (image, audio, video, pdf ...)
          try {
            editor.replaceBlocks(
              [block.id],
              [
                {
                  type: block.props.blockUploadType,
                  props: {
                    url: `${mediaUrl}${response.file}`,
                    showPreview: block.props.blockUploadShowPreview,
                    name: block.props.blockUploadName,
                    caption: '',
                    backgroundColor: 'default',
                    textAlignment: 'left',
                  },
                } as never,
              ],
            );
          } catch {
            /* During collaboration, another user might have updated the block */
          }
        }, randomDelay);
      })
      .catch((error) => {
        console.error('Error analyzing file:', error);

        try {
          editor.updateBlock(block.id, {
            type: 'uploadLoader',
            props: {
              type: 'warning',
              information: t(
                'The antivirus has detected an anomaly in your file.',
              ),
            },
          });
        } catch {
          /* During collaboration, another user might have updated the block */
        }
      });
  }, [block, editor, mediaUrl, isEditable]);

  return (
    <Box className="bn-visual-media-wrapper" $direction="row" $gap="0.5rem">
      {block.props.type === 'warning' ? (
        <Warning />
      ) : (
        <Loader style={{ animation: 'spin 1.5s linear infinite' }} />
      )}
      <Text>{block.props.information}</Text>
    </Box>
  );
};

export const UploadLoaderBlock = createReactBlockSpec(
  {
    type: 'uploadLoader',
    propSchema: {
      information: { default: '' },
      type: {
        default: 'loading',
        values: ['loading', 'warning'],
      },
      blockUploadName: { default: '' },
      blockUploadShowPreview: { default: true },
      blockUploadType: {
        default: '',
      },
      blockUploadUrl: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => <UploadLoaderBlockComponent {...props} />,
  },
);
