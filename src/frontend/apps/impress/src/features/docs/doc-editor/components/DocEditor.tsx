import { useEffect } from 'react';
import { css } from 'styled-components';

import { Box, Loading } from '@/components';
import { DocHeader } from '@/docs/doc-header/';
import { Doc, useProviderStore } from '@/docs/doc-management';
import { TableContent } from '@/docs/doc-table-content/';
import { useSkeletonStore } from '@/features/skeletons';
import { useResponsiveStore } from '@/stores';

import { BlockNoteEditor } from './BlockNoteEditor';

interface DocEditorContainerProps {
  docHeader: React.ReactNode;
  docEditor: React.ReactNode;
}

export const DocEditorContainer = ({
  docHeader,
  docEditor,
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
            {docEditor}
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
        docEditor={<BlockNoteEditor doc={doc} provider={provider} />}
      />
    </>
  );
};
