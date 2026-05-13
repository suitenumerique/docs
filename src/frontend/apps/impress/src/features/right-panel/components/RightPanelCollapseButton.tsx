import { useEffect, useState } from 'react';
import { css } from 'styled-components';

import { Card } from '@/components';
import { CommentSideBarButton } from '@/features/docs/doc-editor/components/comments/CommentSideBar';
import { useEditorStore } from '@/features/docs/doc-editor/stores/useEditorStore';

export const RightPanelCollapseButton = () => {
  const { threadStore } = useEditorStore();
  const [hasThreads, setHasThreads] = useState(
    !!threadStore?.getThreads().size,
  );

  useEffect(() => {
    if (!threadStore) {
      setHasThreads(false);
      return;
    }
    return threadStore.subscribe((threads) => {
      setHasThreads(threads.size > 0);
    });
  }, [threadStore]);

  if (!hasThreads) {
    return null;
  }

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
      {hasThreads && <CommentSideBarButton />}
    </Card>
  );
};
