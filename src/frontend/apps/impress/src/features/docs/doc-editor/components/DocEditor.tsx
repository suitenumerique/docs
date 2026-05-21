import clsx from 'clsx';
import { PropsWithChildren, useEffect, useState } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { DocHeader } from '@/docs/doc-header/';
import {
  Doc,
  LinkReach,
  getDocLinkReach,
  useIsCollaborativeEditable,
  useProviderStore,
} from '@/docs/doc-management';
import { useAuth } from '@/features/auth/';
import { SkeletonEditorCore, useSkeletonStore } from '@/features/skeletons';
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
  useCollaboration(doc.id);
  const { isEditable, isLoading } = useIsCollaborativeEditable(doc);
  const isDeletedDoc = !!doc.deleted_at;
  const readOnly =
    !doc.abilities.partial_update || !isEditable || isLoading || isDeletedDoc;
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
      <DocCoreEditor doc={doc} readOnly={readOnly} />
    </DocEditorContainer>
  );
};

interface DocCoreEditorProps {
  doc: Doc;
  readOnly: boolean;
}

export const DocCoreEditor = ({ doc, readOnly }: DocCoreEditorProps) => {
  const { provider, isReady } = useProviderStore();
  const isProviderReady = isReady && provider;
  const showContent = !!(
    isProviderReady && provider?.configuration.name === doc.id
  );
  const { skeletonVisible, isFadingOut } = useSkeletonFadeOut(showContent);

  if (
    skeletonVisible ||
    !isProviderReady ||
    provider?.configuration.name !== doc.id
  ) {
    return (
      <SkeletonEditorCore
        isFadingOut={isFadingOut}
        $css={css`
          padding-top: 0px;
        `}
      />
    );
  }

  if (readOnly) {
    return (
      <BlockNoteReader
        initialContent={provider.document.getXmlFragment('document-store')}
        docId={doc.id}
      />
    );
  }

  return <BlockNoteEditor doc={doc} provider={provider} />;
};
