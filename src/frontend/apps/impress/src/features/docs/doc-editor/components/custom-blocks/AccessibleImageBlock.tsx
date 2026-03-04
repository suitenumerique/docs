/**
 * AccessibleImageBlock.tsx
 *
 * Custom BlockNote block for accessible images with encryption support.
 *
 * Accessibility (RGAA 1.9.1):
 * - Images with captions are wrapped in <figure> and <figcaption> elements.
 * - The <img> element has an appropriate alt attribute based on the caption.
 * - Images without captions have alt="" and are marked as decorative with aria-hidden="true".
 *
 * Encryption:
 * - Images < 2MB are auto-decrypted inline.
 * - Images >= 2MB show a "click to decrypt" placeholder.
 *
 * https://github.com/TypeCellOS/BlockNote/blob/main/packages/core/src/blocks/Image/block.ts
 */

import {
  BlockNoDefaults,
  BlockNoteEditor,
  InlineContentSchema,
  StyleSchema,
  createImageBlockConfig,
  imageParse,
} from '@blocknote/core';
import {
  ResizableFileBlockWrapper,
  createReactBlockSpec,
} from '@blocknote/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Icon, Loading } from '@/components';

import { ANALYZE_URL } from '../../conf';
import { EncryptedMediaPlaceholder } from '../EncryptedMediaPlaceholder';
import { useEncryption } from '../EncryptionProvider';

type ImageBlockConfig = ReturnType<typeof createImageBlockConfig>;

const AUTOMATIC_DECRYPTION_MAX_SIZE = 2 * 1024 * 1024; // 2 MB

interface AccessibleImageProps {
  src: string;
  caption: string;
}

const AccessibleImage = ({ src, caption }: AccessibleImageProps) => {
  const { t } = useTranslation();

  if (caption) {
    return (
      <figure
        style={{ margin: 0 }}
        role="img"
        aria-label={t('Image: {{title}}', { title: caption })}
      >
        <img
          className="bn-visual-media"
          src={src}
          alt={caption}
          tabIndex={0}
          contentEditable={false}
          draggable={false}
        />
        <figcaption className="bn-file-caption">{caption}</figcaption>
      </figure>
    );
  }

  return (
    <img
      className="bn-visual-media"
      src={src}
      alt=""
      role="presentation"
      aria-hidden="true"
      tabIndex={-1}
      contentEditable={false}
      draggable={false}
    />
  );
};

interface ImageBlockComponentProps {
  block: BlockNoDefaults<
    Record<'image', ImageBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
  contentRef: (node: HTMLElement | null) => void;
  editor: BlockNoteEditor<
    Record<'image', ImageBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
}

const ImageBlockComponent = ({
  editor,
  block,
  ...rest
}: ImageBlockComponentProps) => {
  const { t } = useTranslation();
  const { isEncrypted, decryptFileUrl } = useEncryption();

  const url = block.props.url;
  const caption = block.props.caption || '';
  const isAnalyzing = !!url && url.includes(ANALYZE_URL);

  // Encrypted state
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showClickPlaceholder, setShowClickPlaceholder] = useState(false);

  // Auto-decrypt small files, show placeholder for large ones
  useEffect(() => {
    if (!isEncrypted || !url || isAnalyzing) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(url, { method: 'HEAD', credentials: 'include' })
      .then(async (headResponse) => {
        if (cancelled) {
          return;
        }

        const contentLength = Number(
          headResponse.headers.get('content-length'),
        );

        // Larger images show a "click to decrypt" placeholder instead to save decryption processing
        // (needed since photos taken from a smartphone can easily be over 15MB)
        if (contentLength < AUTOMATIC_DECRYPTION_MAX_SIZE) {
          try {
            const blobUrl = await decryptFileUrl(url);

            if (!cancelled) {
              setResolvedUrl(blobUrl);
            }
          } catch {
            if (!cancelled) {
              setShowClickPlaceholder(true);
            }
          }
        } else {
          if (!cancelled) {
            setShowClickPlaceholder(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShowClickPlaceholder(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEncrypted, url, isAnalyzing, decryptFileUrl]);

  const handleDecrypt = useCallback(async () => {
    if (!url) {
      return;
    }

    setIsLoading(true);
    setHasError(false);
    try {
      const blobUrl = await decryptFileUrl(url);
      setResolvedUrl(blobUrl);
      setShowClickPlaceholder(false);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [url, decryptFileUrl]);

  // Remove the duplicate <p class="bn-file-caption"> added by ResizableFileBlockWrapper
  // when we render our own <figcaption> inside a <figure>.
  const wrapperRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!wrapperRef.current || !caption) {
      return;
    }

    const wrapper = wrapperRef.current.closest(
      '.bn-file-block-content-wrapper',
    );
    if (!wrapper) {
      return;
    }

    const pCaption = wrapper.querySelector(':scope > p.bn-file-caption');
    if (pCaption) {
      pCaption.remove();
    }
  }, [caption]);

  const effectiveUrl = isEncrypted ? resolvedUrl : url;
  const showMedia = !!effectiveUrl && !isAnalyzing;
  const showEncryptedPlaceholder =
    isEncrypted && (showClickPlaceholder || hasError) && !resolvedUrl;

  return (
    <ResizableFileBlockWrapper
      {...({ editor, block, ...rest } as any)}
      buttonIcon={
        <Icon iconName="image" $size="24px" $css="line-height: normal;" />
      }
    >
      {isEncrypted && isLoading && !resolvedUrl && !showClickPlaceholder && (
        <Loading />
      )}
      {showEncryptedPlaceholder && (
        <EncryptedMediaPlaceholder
          label={t('Click to decrypt and view image')}
          errorLabel={t('Failed to decrypt image.')}
          isLoading={isLoading}
          hasError={hasError}
          onDecrypt={() => void handleDecrypt()}
        />
      )}
      {showMedia && (
        <span ref={wrapperRef}>
          <AccessibleImage src={effectiveUrl} caption={caption} />
        </span>
      )}
    </ResizableFileBlockWrapper>
  );
};

const ImageToExternalHTML = ({
  block,
}: {
  block: BlockNoDefaults<
    Record<'image', ImageBlockConfig>,
    InlineContentSchema,
    StyleSchema
  >;
}) => {
  if (!block.props.url) {
    return <p>Add image</p>;
  }

  const img = (
    <img
      src={block.props.url}
      alt={block.props.caption || ''}
      width={block.props.previewWidth}
    />
  );

  if (block.props.caption) {
    return (
      <figure role="img" aria-label={block.props.caption}>
        {img}
        <figcaption>{block.props.caption}</figcaption>
      </figure>
    );
  }

  return img;
};

export const AccessibleImageBlock = createReactBlockSpec(
  createImageBlockConfig,
  (config) => ({
    meta: {
      fileBlockAccept: ['image/*'],
    },
    render: (props) => <ImageBlockComponent {...(props as any)} />,
    parse: imageParse(config),
    toExternalHTML: (props) => <ImageToExternalHTML {...(props as any)} />,
    runsBefore: ['file'],
  }),
);
