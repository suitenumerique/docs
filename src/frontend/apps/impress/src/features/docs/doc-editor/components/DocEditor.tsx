import clsx from 'clsx';
import { useEffect } from 'react';
import { css } from 'styled-components';

import { Box, Loading } from '@/components';
import { DocHeader } from '@/docs/doc-header/';
import {
  Doc,
  useIsCollaborativeEditable,
  useProviderStore,
} from '@/docs/doc-management';
import { TableContent } from '@/docs/doc-table-content/';
import { useSkeletonStore } from '@/features/skeletons';
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
          $css="overflow-x: clip; flex: 1;"
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

  useEffect(() => {
    if (isProviderReady) {
      setIsSkeletonVisible(false);
    }
  }, [isProviderReady, setIsSkeletonVisible]);

  if (!isProviderReady) {
    return <Loading />;
  }

  return (
    <>
      {isDesktop && (
        <Box
          $height="100vh"
          $position="absolute"
          $css={css`
            top: 72px;
            right: 20px;
          `}
        >
          <TableContent />
        </Box>
      )}
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
