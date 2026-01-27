import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';

import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';
import { Doc } from '@/docs/doc-management';
import { useSearchDocs } from '@/docs/doc-management/api/searchDocs';
import { DocSearchTarget } from '@/docs/doc-search';

type DocSearchSubPageContentProps = {
  search: string;
  onSelect: (doc: Doc) => void;
  onLoadingChange?: (loading: boolean) => void;
  renderElement: (doc: Doc) => React.ReactNode;
};

export const DocSearchSubPageContent = ({
  search,
  onSelect,
  onLoadingChange,
  renderElement,
}: DocSearchSubPageContentProps) => {
  const treeContext = useTreeContext<Doc>();

  const {
    data: subDocsData,
    isFetching,
    isRefetching,
    isLoading,
  } = useSearchDocs({
    q: search,
    target: DocSearchTarget.CURRENT,
    parentPath: treeContext?.root?.path,
  });

  const [docsData, setDocsData] = useState<QuickSearchData<Doc>>({
    groupName: '',
    elements: [],
    emptyString: '',
  });

  const loading = isFetching || isRefetching || isLoading;

  useEffect(() => {
    if (loading) {
      return;
    }

    const subDocs = subDocsData?.results || [];

    setDocsData({
      groupName: subDocs.length > 0 ? t('Select a doc') : '',
      elements: search ? subDocs : [],
      emptyString: search ? t('No document found') : t('Search by title'),
    });
  }, [loading, search, subDocsData, subDocsData?.results, treeContext?.root]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  return (
    <QuickSearchGroup
      onSelect={onSelect}
      group={docsData}
      renderElement={renderElement}
    />
  );
};
