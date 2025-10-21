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

import { cssEditor } from '../styles';

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
              $padding={{ top: 'md' }}
              $background="white"
              $css={cssEditor(readOnly, isDeletedDoc)}
              className="--docs--editor-container"
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
  const readOnly = !doc.abilities.partial_update || !isEditable || isLoading;
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
            />
          ) : (
            <BlockNoteEditor doc={doc} provider={provider} />
          )
        }
        isDeletedDoc={!!doc.deleted_at}
        readOnly={readOnly}
      />
    </>
  );
};
