/**
 * EmbedBlock — embeds an external web page in a document via a sandboxed
 * `<iframe>`. The URL is stored in the collaborative document and rendered on
 * every member's machine, so it is treated as untrusted content.
 *
 * ⚠️ To keep it secure, the block enforces three invariants:
 * 1. The URL must be safe (https, no javascript: or data:).
 * 2. The URL must be cross-origin (not same-origin with the app).
 * 3. The URL's host must be explicitly allowlisted server-side
 *    (FRONTEND_EMBED_BLOCK_ALLOWED_ORIGINS). Each allowlist entry also carries
 *    the `sandbox` applied to its iframe, so an embed only gets the
 *    capabilities the administrator granted to that origin. A host that is not
 *    listed is refused, and the user is invited to ask an administrator.
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
import { EmbedAllowedOrigins, useConfig } from '@/core';
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

/**
 * Returns the `sandbox` to apply for a URL, or `undefined` when the host is not
 * covered by the configured origins.
 *
 * Entry formats (port is always significant):
 *  - `"example.com"` — exact host, default port only
 *  - `"example.com:8080"` — exact host, specific port
 *  - `"*.example.com"` — all subdomains, default port only
 *  - `"*.example.com:8080"` — all subdomains, specific port
 *  - `"*"` — catch-all (any host/port)
 *
 * Priority: exact host > longest `"*."` wildcard > `"*"` catch-all.
 * See `matchEmbedOrigin` tests for concrete examples (`./__tests__/EmbedBlock.test.ts`).
 */
export const matchEmbedOrigin = (
  url: string,
  allowedOrigins: EmbedAllowedOrigins,
): string | undefined => {
  let host: string;
  try {
    host = new URL(url, window.location.origin).host.toLowerCase();
  } catch {
    return undefined;
  }

  let bestWildcardMatch: { baseHost: string; sandbox: string } | undefined;
  let catchAllSandbox: string | undefined;

  for (const [origin, sandbox] of Object.entries(allowedOrigins)) {
    let allowedHost = origin.trim().toLowerCase();
    if (allowedHost === '*') {
      catchAllSandbox = sandbox;
      continue;
    }

    if (allowedHost.includes('://')) {
      try {
        allowedHost = new URL(allowedHost).host;
      } catch {
        continue;
      }
    } else {
      allowedHost = allowedHost.split('/')[0];
    }

    const isWildcard = allowedHost.startsWith('*.');
    const baseHost = isWildcard ? allowedHost.slice(2) : allowedHost;
    if (!baseHost) {
      continue;
    }

    if (!isWildcard && host === baseHost) {
      return sandbox;
    }

    if (
      isWildcard &&
      host.endsWith(`.${baseHost}`) &&
      (!bestWildcardMatch ||
        baseHost.length > bestWildcardMatch.baseHost.length)
    ) {
      bestWildcardMatch = { baseHost, sandbox };
    }
  }

  return bestWildcardMatch?.sandbox ?? catchAllSandbox;
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

  const conf = useConfig().data;
  const allowedOrigins = conf?.FRONTEND_EMBED_BLOCK_ALLOWED_ORIGINS ?? {};

  const isUnsafeEmbed =
    !!embedUrl && (!isSafeUrl(embedUrl) || isSameOriginUrl(embedUrl));
  const sandbox =
    !!embedUrl && !isUnsafeEmbed
      ? matchEmbedOrigin(embedUrl, allowedOrigins)
      : undefined;
  const isDisallowedEmbed =
    !!embedUrl && !isUnsafeEmbed && sandbox === undefined;

  if (isUnsafeEmbed) {
    return <CustomBlockStatus>{t('Invalid or unsafe URL.')}</CustomBlockStatus>;
  }

  if (isDisallowedEmbed) {
    return (
      <CustomBlockStatus>
        {t(
          'This domain is not allowed for embedding. Please contact your administrator to have it added to the list of allowed domains.',
        )}
      </CustomBlockStatus>
    );
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
            sandbox={sandbox ?? ''}
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
