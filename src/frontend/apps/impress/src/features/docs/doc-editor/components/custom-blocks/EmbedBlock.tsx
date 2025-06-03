/* eslint-disable react-hooks/rules-of-hooks */
import {
  insertOrUpdateBlock,
  FileBlockConfig,
  PropSchema,
} from '@blocknote/core';
import {
  BlockTypeSelectItem,
  createReactBlockSpec,
  ReactCustomBlockRenderProps,
  ResizableFileBlockWrapper,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import React, { useEffect, useRef, useState } from 'react';
import { css } from 'styled-components';

import { Box, Icon } from '@/components';

import { DocsBlockNoteEditor } from '../../types';

export const iframePropSchema: PropSchema = {
  url: { default: '' },
  caption: { default: '' },
  name: { default: '' },
  showPreview: { default: true },
  previewWidth: { default: 500 },
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
  const aspectRatio = props.block.props.aspectRatio || 16 / 9;
  //   const url = 'http://localhost:8484/o/docs/pmqLaKmSrf3h/Untitled-document/p/2';
  const [iframeError, setIframeError] = React.useState(false);
  const containerRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const wrapperEl = containerRef.current.closest(
      '.bn-file-block-content-wrapper',
    );

    const startResizing = () => {
      setIsResizing(true);
    };
    const stopResizing = () => {
      setIsResizing(false);
    };

    wrapperEl.addEventListener('pointerdown', startResizing);
    document.addEventListener('pointerup', stopResizing);

    return () => {
      wrapperEl.removeEventListener('pointerdown', startResizing);
      document.removeEventListener('pointerdown', stopResizing);
    };
  }, []);

  if (!url) {
    return <Box>No URL provided for embed.</Box>;
  }

  return !iframeError ? (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        paddingTop: `${100 / aspectRatio}%`, // padding-top sets height relative to width
      }}
    >
      <iframe
        src={url}
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
        onError={() => setIframeError(true)}
      />
      {isResizing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'transparent',
            pointerEvents: 'all',
            zIndex: 10,
          }}
        />
      )}
    </div>
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
  />;
};

export const IframeBlock = (
  props: ReactCustomBlockRenderProps<typeof iframeBlockConfig, any, any>,
) => {
  return (
    <ResizableFileBlockWrapper
      {...(props as any)}
      buttonText="Add a callout block"
      buttonIcon={<Icon iconName="link" $size="18px" />}
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
    aliases: ['embed', 'link', 'integration', 'lien'],
    group,
    icon: <Icon iconName="language" $size="18px" />,
    subtext: t('Add an embedded website'),
  },
];

export const getEmbedFormattingToolbarItems = (
  t: TFunction<'translation', undefined>,
): BlockTypeSelectItem => ({
  name: t('Add an embedded website'),
  type: 'embed',
  icon: () => <Icon iconName="link" $size="16px" />,
  isSelected: (block: { type: string }) => block.type === 'embed',
});
