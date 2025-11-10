import { Loader } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';

import { Box, Text, TextErrors } from '@/components';
import { BlockNoteReader, DocEditorContainer } from '@/docs/doc-editor/';
import { Doc, base64ToBlocknoteXmlFragment } from '@/docs/doc-management';
import { Versions, useDocVersion } from '@/docs/doc-versioning/';

import { DocVersionHeader } from './DocVersionHeader';

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
              <Text
                className="material-icons"
                $theme="danger"
                aria-hidden={true}
              >
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

  return (
    <DocEditorContainer
      docHeader={<DocVersionHeader />}
      docEditor={<BlockNoteReader initialContent={initialContent} />}
      isDeletedDoc={false}
      readOnly={true}
    />
  );
};
