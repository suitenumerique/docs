import { useEffect, useState } from 'react';

import { CommentSideBarButton } from '@/features/docs/doc-editor/components/comments/CommentSideBar';
import { useEditorStore } from '@/features/docs/doc-editor/stores/useEditorStore';
import { useHeadingStore } from '@/features/docs/doc-editor/stores/useHeadingStore';
import { TableContentSideBarButton } from '@/features/docs/doc-table-content/components/TableContentSideBar';

export const RightPanelCollapseButton = () => {
  const { threadStore } = useEditorStore();
  const [hasThreads, setHasThreads] = useState(
    !!threadStore?.getThreads().size,
  );
  const { headings } = useHeadingStore();
  const hasHeadings = headings.length > 0;

  useEffect(() => {
    if (!threadStore) {
      setHasThreads(false);
      return;
    }
    return threadStore.subscribe((threads) => {
      setHasThreads(threads.size > 0);
    });
  }, [threadStore]);

  if (!hasThreads && !hasHeadings) {
    return null;
  }

  return (
    <>
      {hasHeadings && <TableContentSideBarButton />}
      {hasThreads && <CommentSideBarButton />}
    </>
  );
};
