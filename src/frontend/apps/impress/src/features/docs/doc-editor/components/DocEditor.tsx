import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { Box, Loading } from '@/components';
import { DocHeader, FloatingBar } from '@/docs/doc-header/';
import {
  Doc,
  LinkReach,
  getDocLinkReach,
  useIsCollaborativeEditable,
  useProviderStore,
} from '@/docs/doc-management';
import { TableContent } from '@/docs/doc-table-content/';
import { useAuth } from '@/features/auth/';
import { useSkeletonStore } from '@/features/skeletons';
import { useAnalytics } from '@/libs';
import { useResponsiveStore } from '@/stores';

import { BlockNoteEditor, BlockNoteReader } from './BlockNoteEditor';

interface DocEditorContainerProps {
  docHeader: React.ReactNode;
  docEditor: React.ReactNode;
  isDeletedDoc: boolean;
  readOnly: boolean;
}

export const DocEditorContainer = ({
  docHeader,
  docEditor,
  isDeletedDoc,
  readOnly,
}: DocEditorContainerProps) => {
  const { isDesktop } = useResponsiveStore();

  return (
    <>
      {isDesktop && <FloatingBar />}
      <Box
        $maxWidth="868px"
        $width="100%"
        $height="100%"
        className="--docs--doc-editor"
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
              $background="white"
              className={clsx('--docs--editor-container', {
                '--docs--doc-readonly': readOnly,
                '--docs--doc-deleted': isDeletedDoc,
              })}
              $height="100%"
            >
              {docEditor}
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
  const { isDesktop } = useResponsiveStore();
  const { provider, isReady } = useProviderStore();
  const { isEditable, isLoading } = useIsCollaborativeEditable(doc);
  const isDeletedDoc = !!doc.deleted_at;
  const readOnly =
    !doc.abilities.partial_update || !isEditable || isLoading || isDeletedDoc;
  const { setIsSkeletonVisible } = useSkeletonStore();
  const isProviderReady = isReady && provider;
  const { trackEvent } = useAnalytics();
  const [hasTracked, setHasTracked] = useState(false);
  const { authenticated } = useAuth();
  const isPublicDoc = getDocLinkReach(doc) === LinkReach.PUBLIC;

  useEffect(() => {
    if (isProviderReady) {
      setIsSkeletonVisible(false);
    }
  }, [isProviderReady, setIsSkeletonVisible]);

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

  if (!isProviderReady || provider?.configuration.name !== doc.id) {
    return <Loading />;
  }

  return (
    <>
      {isDesktop && <TableContent />}
      <DocEditorContainer
        docHeader={<DocHeader doc={doc} />}
        docEditor={
          readOnly ? (
            <BlockNoteReader
              initialContent={provider.document.getXmlFragment(
                'document-store',
              )}
              docId={doc.id}
            />
          ) : (
            <BlockNoteEditor doc={doc} provider={provider} />
          )
        }
        isDeletedDoc={isDeletedDoc}
        readOnly={readOnly}
      />
    </>
  );
};
