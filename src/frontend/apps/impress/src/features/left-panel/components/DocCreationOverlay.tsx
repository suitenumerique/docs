import { css } from 'styled-components';

import { Box } from '@/components';
import { DocEditorSkeleton } from '@/features/docs/doc-editor/components/DocEditorSkeleton';

import { useDocCreationLoadingStore } from '../stores';

export const DocCreationOverlay = () => {
  const { isCreatingDoc } = useDocCreationLoadingStore();

  if (!isCreatingDoc) {
    return null;
  }

  return (
    <Box
      $align="center"
      $width="100%"
      $height="100%"
      $background="white"
      $css={css`
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999;
        overflow: auto;
      `}
    >
      <DocEditorSkeleton />
    </Box>
  );
};
