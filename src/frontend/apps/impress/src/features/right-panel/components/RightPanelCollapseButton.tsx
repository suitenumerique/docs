import { css } from 'styled-components';

import { Card } from '@/components';
import { CommentSideBarButton } from '@/features/docs/doc-editor/components/comments/CommentSideBar';
import { TableContentSideBarButton } from '@/features/docs/doc-table-content/components/TableContentSideBar';

export const RightPanelCollapseButton = () => {
  return (
    <Card
      className="--docs--right-panel-collapse-button"
      $direction="row"
      $css={css`
        padding: var(--c--globals--spacings--xxxs);
        align-items: center;
        gap: var(--c--globals--spacings--xxxs);
        border-radius: var(--c--globals--spacings--xs);
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
      `}
    >
      <TableContentSideBarButton />
      <CommentSideBarButton />
    </Card>
  );
};
