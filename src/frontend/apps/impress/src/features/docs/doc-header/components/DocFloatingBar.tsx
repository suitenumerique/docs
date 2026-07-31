import { Box } from '@/components';
import { CardFloatingBar, FloatingBar } from '@/components/FloatingBar';
import { DocToolBox } from '@/docs/doc-management/components/DocToolBox';
import { useDocStore } from '@/docs/doc-management/stores/useDocStore';
import { DocShareButton } from '@/docs/doc-share/components/DocShareButton';
import { RightPanelCollapseButton } from '@/features/right-panel/components/RightPanelCollapseButton';

import { DocLeftPanelCollapseButton } from './DocLeftPanelCollapseButton';

export const DocFloatingBar = () => {
  const { currentDoc } = useDocStore();
  const isDeletedDoc = !!currentDoc?.deleted_at;

  return (
    <FloatingBar>
      <DocLeftPanelCollapseButton />
      <Box $direction="row" $align="center" $gap="2xs">
        {!isDeletedDoc && currentDoc && <DocShareButton doc={currentDoc} />}
        <CardFloatingBar>
          <RightPanelCollapseButton />
          {!isDeletedDoc && currentDoc && <DocToolBox doc={currentDoc} />}
        </CardFloatingBar>
      </Box>
    </FloatingBar>
  );
};
