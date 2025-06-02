import {
  FileBlockConfig,
  InlineContentSchema,
  PropSchema,
  StyleSchema,
  insertOrUpdateBlock,
} from '@blocknote/core';
import {
  BlockTypeSelectItem,
  ReactCustomBlockRenderProps,
  ResizableFileBlockWrapper,
  createReactBlockSpec,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useState } from 'react';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

export const iframePropSchema: PropSchema & {
  caption: {
    default: '';
  };
  name: {
    default: '';
  };
} = {
  url: { default: '' },
  caption: { default: '' },
  name: { default: '' },
  showPreview: { default: true },
  previewWidth: { type: 'number', default: undefined },
};

export const iframeBlockConfig = {
  type: 'embed' as const,
  propSchema: iframePropSchema,
  content: 'none',
  isFileBlock: true,
  fileBlockAccept: ['image/png'],
} satisfies FileBlockConfig;

export const IFrameViewer = (
  props: ReactCustomBlockRenderProps<
    typeof iframeBlockConfig,
    InlineContentSchema,
    StyleSchema
  >,
) => {
  const url = props.block.props.url;

  const [iframeError, setIframeError] = useState(false);
  if (!url) {
    return <Box>No URL provided for embed.</Box>;
  }

  return !iframeError ? (
    <iframe
      src={url}
      className="bn-visual-media"
      style={{
        height: '300px',
      }}
      allowFullScreen
      title="Embedded content"
      onError={() => setIframeError(true)}
    />
  ) : (
    <Box
      $css={css`
        color: #d32f2f;
        background: #fff3f3;
        border: 1px solid #f8d7da;
        border-radius: 6px;
        padding: 1rem;
      `}
    >
      <Icon iconName="error" $size="16px" /> This site cannot be embedded. It
      may not allow embedding in an iframe.
    </Box>
  );
};

export const IframeToExternalHTML = (
  props: ReactCustomBlockRenderProps<
    typeof iframeBlockConfig,
    InlineContentSchema,
    StyleSchema
  >,
) => (
  <iframe
    src={props.block.props.url}
    className="bn-visual-media"
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: 'none',
    }}
    allowFullScreen
    title="Embedded content"
  />
);

export const IframeBlock = (
  props: ReactCustomBlockRenderProps<
    typeof iframeBlockConfig,
    InlineContentSchema,
    StyleSchema
  >,
) => {
  return (
    <ResizableFileBlockWrapper
      {...(props as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
      buttonText="Embed"
      buttonIcon={<Icon iconName="language" $size="18px" />}
    >
      <IFrameViewer {...props} />
    </ResizableFileBlockWrapper>
  );
};

export const ReactEmbedBlock = createReactBlockSpec(iframeBlockConfig, {
  render: IframeBlock,
  parse: () => undefined,
  toExternalHTML: IframeToExternalHTML,
});

export const getEmbedReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Embed'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'embed',
      });
    },
    aliases: ['embed', 'iframe', 'link'],
    group,
    icon: <Icon iconName="link" $size="18px" />,
    subtext: t('Add an embed block'),
  },
];

export const getEmbedFormattingToolbarItems = (
  t: TFunction<'translation', undefined>,
): BlockTypeSelectItem => ({
  name: t('Embed'),
  type: 'embed',
  icon: () => <Icon iconName="link" $size="16px" />,
  isSelected: (block: any) => block.type === 'embed',
});
