import { BlockNoteEditor } from '@blocknote/core';
import { Loader } from '@gouvfr-lasuite/cunningham-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, TextErrors } from '@/components';
import { blockNoteSchema } from '@/docs/doc-editor/components/BlockNoteEditor';
import { Doc, base64ToYDoc } from '@/docs/doc-management';

import { useDocVersion } from '../api/useDocVersion';
import { DiffBlock, Versions } from '../types';
import { diffBlocks } from '../utils/diffBlocks';

import { DiffBlockRenderer } from './DiffBlockRenderer';
import { DocVersionHeader } from './DocVersionHeader';

/**
 * Convert a base64-encoded Y.Doc to an array of BlockNote blocks
 * by creating a temporary editor instance.
 */
function base64ToBlocks(base64: string) {
  const ydoc = base64ToYDoc(base64);
  const fragment = ydoc.getXmlFragment('document-store');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = (BlockNoteEditor as any).create({
    collaboration: {
      fragment,
      user: { name: '', color: '' },
      provider: undefined,
    },
    schema: blockNoteSchema,
  });

  return editor.document;
}

interface DocVersionDiffEditorProps {
  docId: Doc['id'];
  baseVersionId: Versions['version_id'];
  targetVersionId: Versions['version_id'];
}

export const DocVersionDiffEditor = ({
  docId,
  baseVersionId,
  targetVersionId,
}: DocVersionDiffEditorProps) => {
  const { t } = useTranslation();

  const {
    data: baseVersion,
    isLoading: isLoadingBase,
    isError: isErrorBase,
    error: errorBase,
  } = useDocVersion({ docId, versionId: baseVersionId });

  const {
    data: targetVersion,
    isLoading: isLoadingTarget,
    isError: isErrorTarget,
    error: errorTarget,
  } = useDocVersion({ docId, versionId: targetVersionId });

  const isLoading = isLoadingBase || isLoadingTarget;
  const error = errorBase || errorTarget;

  const diff: DiffBlock[] | null = useMemo(() => {
    if (!baseVersion?.content || !targetVersion?.content) {
      return null;
    }

    try {
      const baseBlocks = base64ToBlocks(baseVersion.content);
      const targetBlocks = base64ToBlocks(targetVersion.content);
      return diffBlocks(baseBlocks, targetBlocks);
    } catch (e) {
      console.error('Failed to compute version diff', e);
      return null;
    }
  }, [baseVersion?.content, targetVersion?.content]);

  if ((isErrorBase && errorBase) || (isErrorTarget && errorTarget)) {
    return (
      <Box $margin="large" className="--docs--doc-version-diff-error">
        <TextErrors causes={error?.cause} />
      </Box>
    );
  }

  if (isLoading || !diff) {
    return (
      <Box $align="center" $justify="center" $height="100%">
        <Loader />
      </Box>
    );
  }

  return (
    <Box $width="100%">
      <DocVersionHeader />
      <DiffBlockRenderer diffBlocks={diff} />
    </Box>
  );
};
