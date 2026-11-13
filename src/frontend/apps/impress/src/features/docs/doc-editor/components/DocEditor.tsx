import clsx from 'clsx';
import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { DocHeader } from '@/docs/doc-header/';
import {
  Doc,
  LinkReach,
  getDocLinkReach,
  useProviderStore,
} from '@/docs/doc-management';
import { useAuth } from '@/features/auth/';
import {
  SKELETON_FADE_DURATION_MS,
  SkeletonEditorCore,
  useSkeletonStore,
} from '@/features/skeletons';
import { useSkeletonFadeOut } from '@/features/skeletons/hooks/useFadeOut';
import { useAnalytics } from '@/libs';
import { useResponsiveStore } from '@/stores';

import { useCollaboration } from '../hook/useCollaboration';

import { BlockNoteEditor, BlockNoteReader } from './BlockNoteEditor';

const DOCS_EDITOR_CLASS = '--docs--doc-editor';

interface DocEditorContainerProps {
  docHeader: React.ReactNode;
  isDeletedDoc: boolean;
  readOnly: boolean;
}

export const DocEditorContainer = ({
  children,
  docHeader,
  isDeletedDoc,
  readOnly,
}: PropsWithChildren<DocEditorContainerProps>) => {
  const { isDesktop } = useResponsiveStore();

  return (
    <>
      <Box
        $maxWidth="868px"
        $width="100%"
        $flex="1"
        className={DOCS_EDITOR_CLASS}
        $margin={{ horizontal: 'auto' }}
      >
        <Box
          $padding={{ horizontal: isDesktop ? '54px' : 'base' }}
          className="--docs--doc-editor-header"
        >
          {docHeader}
        </Box>

        <Box
          $direction="row"
          $width="100%"
          $css="flex: 1;"
          $position="relative"
          className="--docs--doc-editor-content"
        >
          <Box $css="flex:1;" $position="relative" $width="100%">
            <Box
              $padding={{ top: 'md', bottom: '2rem' }}
              $background="var(--c--contextuals--background--surface--primary)"
              className={clsx('--docs--editor-container', {
                '--docs--doc-readonly': readOnly,
                '--docs--doc-deleted': isDeletedDoc,
              })}
              $height="100%"
            >
              {children}
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

interface DocEditorProps {
  doc: Doc;
}

export const DocEditor = ({ doc }: DocEditorProps) => {
  const isDeletedDoc = !!doc.deleted_at;
  const readOnly = !doc.abilities.partial_update || isDeletedDoc;
  // the collaboration providers are built from this too: a reader publishes no
  // presence, on either transport
  useCollaboration(doc.id, readOnly);
  const { trackEvent } = useAnalytics();
  const [hasTracked, setHasTracked] = useState(false);
  const { authenticated } = useAuth();
  const isPublicDoc = getDocLinkReach(doc) === LinkReach.PUBLIC;
  const { setIsSkeletonVisible } = useSkeletonStore();

  useEffect(() => {
    setIsSkeletonVisible(false);
  }, [setIsSkeletonVisible, doc.id]);

  /**
   * Track doc view event only once per doc change
   */
  useEffect(() => {
    setHasTracked(false);
  }, [doc.id]);

  /**
   * Track doc view event
   */
  useEffect(() => {
    if (hasTracked) {
      return;
    }

    setHasTracked(true);

    trackEvent({
      eventName: 'doc',
      isPublic: isPublicDoc,
      authenticated,
    });
  }, [authenticated, hasTracked, isPublicDoc, trackEvent]);

  return (
    <DocEditorContainer
      docHeader={<DocHeader doc={doc} />}
      isDeletedDoc={isDeletedDoc}
      readOnly={readOnly}
    >
      <DocCoreEditor
        key={`${doc.id}:${readOnly ? 'r' : 'w'}`}
        doc={doc}
        readOnly={readOnly}
      />
    </DocEditorContainer>
  );
};

interface DocCoreEditorProps {
  doc: Doc;
  readOnly: boolean;
}

export const DocCoreEditor = ({ doc, readOnly }: DocCoreEditorProps) => {
  const { provider, isReady } = useProviderStore();
  const isProviderReadyForDoc = !!(
    isReady &&
    provider &&
    provider.roomname === doc.id
  );

  // The editor mounts as soon as the provider is ready; `isEditorRendered`
  // flips once BlockNote has actually painted content so the skeleton can
  // fade out without flashing an empty doc on large files. DocEditor keys
  // this component by `doc.id` + `readOnly` so a fresh instance starts at
  // `false` on each editor replacement, before paint — the provider-loss
  // case stays on the same key, so the effect below covers it.
  const [isEditorRendered, setIsEditorRendered] = useState(false);
  const handleEditorReady = useCallback(() => {
    setIsEditorRendered(true);
  }, []);

  useEffect(() => {
    if (!isProviderReadyForDoc) {
      setIsEditorRendered(false);
    }
  }, [isProviderReadyForDoc]);

  const showContent = isProviderReadyForDoc && isEditorRendered;
  const { skeletonVisible, isFadingOut } = useSkeletonFadeOut(showContent);

  if (!isProviderReadyForDoc) {
    return (
      <SkeletonEditorCore
        $css={css`
          padding-top: 0px;
        `}
      />
    );
  }

  return (
    <Box $position="relative" $width="100%" $height="100%">
      {/* `inert` keeps the hidden editor out of focus and input while the
          skeleton covers it, so a Tab or stray click cannot land on a doc
          the user cannot see. */}
      <Box $width="100%" $height="100%" inert={skeletonVisible || undefined}>
        {readOnly ? (
          <BlockNoteReader
            initialContent={provider.doc.getXmlFragment('document-store')}
            docId={doc.id}
            onReady={handleEditorReady}
          />
        ) : (
          <BlockNoteEditor
            doc={doc}
            provider={provider}
            onReady={handleEditorReady}
          />
        )}
      </Box>
      {skeletonVisible && (
        <Box
          $position="absolute"
          $width="100%"
          $height="100%"
          $background="var(--c--contextuals--background--surface--primary)"
          $css={css`
            top: 0;
            left: 0;
            opacity: ${isFadingOut ? 0 : 1};
            transition: opacity ${SKELETON_FADE_DURATION_MS}ms ease-in-out;
          `}
        >
          <SkeletonEditorCore
            isFadingOut={isFadingOut}
            $css={css`
              padding-top: 0px;
            `}
          />
        </Box>
      )}
    </Box>
  );
};
