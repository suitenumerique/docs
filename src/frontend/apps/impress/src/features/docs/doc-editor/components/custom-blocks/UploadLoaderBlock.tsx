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

import { Text } from '@/components';
import { useMediaUrl } from '@/core';
import { isSafeUrl } from '@/utils/url';

import { loopCheckDocMediaStatus } from '../../api';

import { CustomBlockStatus } from './CustomBlockStatus';

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

    if (!shouldCheckStatus || !isSafeUrl(block.props.blockUploadUrl)) {
      return;
    }

    const url = block.props.blockUploadUrl;
    const controller = new AbortController();

    loopCheckDocMediaStatus(url, controller.signal)
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
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

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

    return () => {
      controller.abort();
    };
  }, [block, editor, mediaUrl, isEditable]);

  return (
    <CustomBlockStatus
      className="bn-visual-media-wrapper"
      type={block.props.type}
    >
      <Text>{block.props.information}</Text>
    </CustomBlockStatus>
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
