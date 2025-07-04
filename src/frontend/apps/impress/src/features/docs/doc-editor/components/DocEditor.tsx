import { Loader } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { css } from 'styled-components';
import * as Y from 'yjs';

import { Box, Text, TextErrors } from '@/components';
import { DocHeader, DocVersionHeader } from '@/docs/doc-header/';
import {
  Doc,
  base64ToBlocknoteXmlFragment,
  useProviderStore,
} from '@/docs/doc-management';
import { TableContent } from '@/docs/doc-table-content/';
import { Versions, useDocVersion } from '@/docs/doc-versioning/';
import { useResponsiveStore } from '@/stores';

import { BlockNoteEditor, BlockNoteEditorVersion } from './BlockNoteEditor';

interface DocEditorProps {
  doc: Doc;
  versionId?: Versions['version_id'];
}

export const DocEditor = ({ doc, versionId }: DocEditorProps) => {
  const { isDesktop } = useResponsiveStore();
  const isVersion = !!versionId && typeof versionId === 'string';
  const { provider } = useProviderStore();

  if (!provider) {
    return null;
  }

  return (
    <>
      {isDesktop && !isVersion && (
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
          {isVersion ? <DocVersionHeader /> : <DocHeader doc={doc} />}
        </Box>

        <Box
          $direction="row"
          $width="100%"
          $css="overflow-x: clip; flex: 1;"
          $position="relative"
          className="--docs--doc-editor-content"
        >
          <Box $css="flex:1;" $position="relative" $width="100%">
            {isVersion ? (
              <DocVersionEditor docId={doc.id} versionId={versionId} />
            ) : (
              <BlockNoteEditor doc={doc} provider={provider} />
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
};

interface DocVersionEditorProps {
  docId: Doc['id'];
  versionId: Versions['version_id'];
}

export const DocVersionEditor = ({
  docId,
  versionId,
}: DocVersionEditorProps) => {
  const {
    data: version,
    isLoading,
    isError,
    error,
  } = useDocVersion({
    docId,
    versionId,
  });

  const { replace } = useRouter();
  const [initialContent, setInitialContent] = useState<Y.XmlFragment>();

  useEffect(() => {
    if (!version?.content) {
      return;
    }

    setInitialContent(base64ToBlocknoteXmlFragment(version.content));
  }, [version?.content]);

  if (isError && error) {
    if (error.status === 404) {
      void replace(`/404`);
      return null;
    }

    return (
      <Box $margin="large" className="--docs--doc-version-editor-error">
        <TextErrors
          causes={error.cause}
          icon={
            error.status === 502 ? (
              <Text className="material-icons" $theme="danger">
                wifi_off
              </Text>
            ) : undefined
          }
        />
      </Box>
    );
  }

  if (isLoading || !version || !initialContent) {
    return (
      <Box $align="center" $justify="center" $height="100%">
        <Loader />
      </Box>
    );
  }

  return <BlockNoteEditorVersion initialContent={initialContent} />;
};
