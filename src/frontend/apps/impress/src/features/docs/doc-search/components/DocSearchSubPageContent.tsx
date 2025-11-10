import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { InView } from 'react-intersection-observer';

import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';
import { Doc, useInfiniteSubDocs } from '@/docs/doc-management';

import { DocSearchFiltersValues } from './DocSearchFilters';

type DocSearchSubPageContentProps = {
  search: string;
  filters: DocSearchFiltersValues;
  onSelect: (doc: Doc) => void;
  onLoadingChange?: (loading: boolean) => void;
  renderElement: (doc: Doc) => React.ReactNode;
};

export const DocSearchSubPageContent = ({
  search,
  filters,
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
    fetchNextPage: subDocsFetchNextPage,
    hasNextPage: subDocsHasNextPage,
  } = useInfiniteSubDocs(
    {
      page: 1,
      title: search,
      ...filters,
      parent_id: treeContext?.root?.id ?? '',
    },
    {
      enabled: !!treeContext?.root?.id,
    },
  );
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

    const subDocs = subDocsData?.pages.flatMap((page) => page.results) || [];

    if (treeContext?.root) {
      const isRootTitleIncludeSearch = treeContext.root?.title
        ?.toLowerCase()
        .includes(search.toLowerCase());

      if (isRootTitleIncludeSearch) {
        subDocs.unshift(treeContext.root);
      }
    }

    setDocsData({
      groupName: subDocs.length > 0 ? t('Select a doc') : '',
      elements: search ? subDocs : [],
      emptyString: search ? t('No document found') : t('Search by title'),
      endActions: subDocsHasNextPage
        ? [
            {
              content: <InView onChange={() => void subDocsFetchNextPage()} />,
            },
          ]
        : [],
    });
  }, [
    loading,
    search,
    subDocsData?.pages,
    subDocsFetchNextPage,
    subDocsHasNextPage,
    treeContext?.root,
  ]);

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
