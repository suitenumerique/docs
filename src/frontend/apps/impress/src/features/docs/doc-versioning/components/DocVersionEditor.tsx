import { Loader } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';

import { Box, Text, TextErrors } from '@/components';
import { BlockNoteReader } from '@/docs/doc-editor/components/BlockNoteEditor';
import { DocEditorContainer } from '@/docs/doc-editor/components/DocEditor';
import { Doc, base64ToBlocknoteXmlFragment } from '@/docs/doc-management';

import { useDocVersion } from '../api/useDocVersion';
import { DocVersion } from '../types';

import { DocVersionHeader } from './DocVersionHeader';

interface DocVersionEditorProps {
  docId: Doc['id'];
  versionId: DocVersion['id'];
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

  // Reset initialContent when versionId changes to avoid conflicts between versions
  useEffect(() => {
    setInitialContent(undefined);
  }, [versionId]);

  useEffect(() => {
    if (!version?.ydoc || isLoading || initialContent) {
      return;
    }

    setInitialContent(base64ToBlocknoteXmlFragment(version.ydoc));
  }, [versionId, version?.ydoc, isLoading, initialContent]);

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
      isDeletedDoc={false}
      readOnly={true}
    >
      <BlockNoteReader
        initialContent={initialContent}
        /**
         * The version, not the document: this identifies the thread store the
         * preview reads, and a read-only view of an older state has no business
         * sharing the live one.
         */
        docId={versionId}
        isMainEditor={false}
      />
    </DocEditorContainer>
  );
};
