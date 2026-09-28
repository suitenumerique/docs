import { useEffect, useState } from 'react';

import { CommentSideBarButton } from '@/docs/doc-comments/components/CommentSideBar';
import { useThreadStore } from '@/docs/doc-comments/stores/useThreadStore';
import { useHeadingStore } from '@/docs/doc-editor/stores/useHeadingStore';
import { TableContentSideBarButton } from '@/docs/doc-table-content/components/TableContentSideBar';

export const RightPanelCollapseButton = () => {
  const { threadStore } = useThreadStore();
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
