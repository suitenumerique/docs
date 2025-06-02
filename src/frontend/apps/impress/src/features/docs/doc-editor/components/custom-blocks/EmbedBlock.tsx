/* eslint-disable react-hooks/rules-of-hooks */
import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { css } from 'styled-components';

import { Box, BoxButton, Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

export const iframePropSchema: PropSchema = {
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
  props: ReactCustomBlockRenderProps<typeof iframeBlockConfig>,
) => {
  const url = props.block.props.url;
  //   const url = 'http://localhost:8484/o/docs/pmqLaKmSrf3h/Untitled-document/p/2';
  const [iframeError, setIframeError] = React.useState(false);
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
  props: ReactCustomBlockRenderProps<typeof iframeBlockConfig, any, any>,
) => {
  if (!props.block.props.url) {
    return <p>Add embed</p>;
  }
  //   return (
  //     <iframe
  //       src={props.block.props.url}
  //       title="Embedded content"
  //       style={{
  //         width: '100%',
  //         minHeight: '300px',
  //         border: '1px solid #eee',
  //         borderRadius: '6px',
  //       }}
  //       allowFullScreen
  //     />
  //   );
};

export const IframeBlock = (
  props: ReactCustomBlockRenderProps<typeof iframeBlockConfig, any, any>,
) => {
  return (
    <ResizableFileBlockWrapper
      {...(props as any)}
      buttonText="Embed"
      buttonIcon={<Icon iconName="language" $size="18px" />}
    >
      <IFrameViewer {...(props as any)} />
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
