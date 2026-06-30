import { Box } from '@/components';
import { CardFloatingBar, FloatingBar } from '@/components/FloatingBar';
import { useDocStore } from '@/docs/doc-management/stores/useDocStore';
import { DocShareButton } from '@/features/docs/doc-share/components/DocShareButton';
import { RightPanelCollapseButton } from '@/features/right-panel/components/RightPanelCollapseButton';

import { DocLeftPanelCollapseButton } from './DocLeftPanelCollapseButton';
import { DocToolBox } from './DocToolBox';

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
