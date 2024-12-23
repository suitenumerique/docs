import { Loader } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { css } from 'styled-components';
import * as Y from 'yjs';

import { Box, Text, TextErrors } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { DocHeader, DocVersionHeader } from '@/features/docs/doc-header/';
import {
  Doc,
  base64ToBlocknoteXmlFragment,
  useProviderStore,
} from '@/features/docs/doc-management';
import { TableContent } from '@/features/docs/doc-table-content/';
import { Versions, useDocVersion } from '@/features/docs/doc-versioning/';
import { useResponsiveStore } from '@/stores';

import { BlockNoteEditor, BlockNoteEditorVersion } from './BlockNoteEditor';

interface DocEditorProps {
  doc: Doc;
  versionId?: Versions['version_id'];
}

export const DocEditor = ({ doc, versionId }: DocEditorProps) => {
  const { isDesktop } = useResponsiveStore();

  const isVersion = !!versionId && typeof versionId === 'string';

  const { colorsTokens } = useCunninghamTheme();

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
      <Box $maxWidth="868px" $width="100%" $height="100%">
        <Box $padding={{ horizontal: isDesktop ? '54px' : 'base' }}>
          {isVersion ? (
            <DocVersionHeader title={doc.title} />
          ) : (
            <DocHeader doc={doc} />
          )}
        </Box>

        <Box
          $background={colorsTokens()['primary-bg']}
          $direction="row"
          $width="100%"
          $css="overflow-x: clip; flex: 1;"
          $position="relative"
        >
          <Box $css="flex:1;" $overflow="auto" $position="relative">
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
      <Box $margin="large">
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
