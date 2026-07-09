/**
 * EmbedBlock — embeds an external web page in a document via a sandboxed
 * `<iframe>`. The URL is stored in the collaborative document and rendered on
 * every member's machine, so it is treated as untrusted content.
 *
 * ⚠️ To keep it secure, the block enforces two invariants:
 * 1. The URL must be safe (https, no javascript: or data:).
 * 2. The URL must be cross-origin (not same-origin with the app).
 *
 * Two layers keep it cross-origin, where the
 * Same-Origin Policy blocks parent access:
 *   1. `isSameOriginUrl` rejects same-origin URLs on every render (re-checked
 *      per viewer, not just at insert time).
 *   2. `X-Frame-Options: DENY` (nginx) and `frame-ancestors 'none'` (backend
 *      CSP) stop the embed redirecting its frame back into the app origin.
 *
 * When editing, keep these invariants: don't weaken `isSameOriginUrl`; keep the
 * anti-framing headers on every same-origin route.
 */

import {
  BlockConfig,
  BlockNoDefaults,
  BlockNoteEditor,
  InlineContentSchema,
  StyleSchema,
} from '@blocknote/core';
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import * as locales from '@blocknote/core/locales';
import {
  AddFileButton,
  ResizableFileBlockWrapper,
  createReactBlockSpec,
} from '@blocknote/react';
import { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, Icon } from '@/components';
import { isSafeUrl } from '@/utils/url';

import { DocsBlockNoteEditor } from '../../types';

import { CustomBlockStatus } from './CustomBlockStatus';

const EmbedBlockStyle = createGlobalStyle`
  .bn-block-content[data-content-type="embed"] .bn-file-block-content-wrapper {
    width: fit-content;
  }
  .bn-block-content[data-content-type="embed"] .bn-file-block-content-wrapper[style*="fit-content"] {
    width: 100% !important;
  }
`;

type FileBlockEditor = Parameters<typeof AddFileButton>[0]['editor'];
type FileBlockBlock = Parameters<typeof AddFileButton>[0]['block'];

export const isSameOriginUrl = (url: string): boolean => {
  try {
    return (
      new URL(url, window.location.origin).origin === window.location.origin
    );
  } catch {
    return true;
  }
};

type CreateEmbedBlockConfig = BlockConfig<
  'embed',
  {
    backgroundColor: { default: 'default' };
    caption: { default: '' };
    name: { default: '' };
    previewWidth: { default: undefined; type: 'number' };
    showPreview: { default: true };
    textAlignment: { default: 'left' };
    uploadDisabled: { default: true };
    url: { default: '' };
  },
  'none'
>;

interface EmbedBlockComponentProps {
  block: BlockNoDefaults<
    Record<'embed', CreateEmbedBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
  editor: BlockNoteEditor<
    Record<'embed', CreateEmbedBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
}

const EmbedBlockComponent = ({ editor, block }: EmbedBlockComponentProps) => {
  const embedUrl = block.props.url;
  const { i18n, t } = useTranslation();
  const lang = i18n.resolvedLanguage;

  useEffect(() => {
    if (lang && locales[lang as keyof typeof locales]) {
      locales[lang as keyof typeof locales].file_blocks.add_button_text[
        'embed'
      ] = t('Add embed');
      (
        locales[lang as keyof typeof locales].file_panel.embed
          .embed_button as Record<string, string>
      )['embed'] = t('Embed');
    }
  }, [lang, t]);

  const isInvalidEmbed =
    !!embedUrl && (!isSafeUrl(embedUrl) || isSameOriginUrl(embedUrl));

  if (isInvalidEmbed) {
    return <CustomBlockStatus>{t('Invalid or unsafe URL.')}</CustomBlockStatus>;
  }

  return (
    <>
      <EmbedBlockStyle />
      <ResizableFileBlockWrapper
        buttonIcon={
          <Icon iconName="public" $size="24px" $css="line-height: normal;" />
        }
        block={block as unknown as FileBlockBlock}
        editor={editor as unknown as FileBlockEditor}
      >
        {!!embedUrl && (
          <Box
            as="iframe"
            className="bn-visual-media"
            role="presentation"
            $width="100%"
            $height="450px"
            src={embedUrl}
            title={block.props.name || t('Embedded content')}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            referrerPolicy="no-referrer"
            loading="lazy"
            contentEditable={false}
            draggable={false}
          />
        )}
      </ResizableFileBlockWrapper>
    </>
  );
};

export const EmbedBlock = createReactBlockSpec(
  {
    type: 'embed',
    content: 'none',
    propSchema: {
      backgroundColor: { default: 'default' as const },
      caption: { default: '' as const },
      name: { default: '' as const },
      previewWidth: { default: undefined, type: 'number' },
      showPreview: { default: true },
      textAlignment: { default: 'left' as const },
      uploadDisabled: { default: true },
      url: { default: '' as const },
    },
  },
  {
    meta: {
      fileBlockAccept: [],
    },
    render: (props) => <EmbedBlockComponent {...props} />,
  },
);

export const getEmbedReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Embed'),
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, { type: 'embed' });
    },
    aliases: [t('embed'), t('iframe'), t('website'), t('link')],
    group,
    icon: <Icon iconName="public" $size="18px" />,
    subtext: t('Embed a web page'),
  },
];
