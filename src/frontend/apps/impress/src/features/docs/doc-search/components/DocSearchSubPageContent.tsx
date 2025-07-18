import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import { t } from 'i18next';
import React, { useEffect, useMemo } from 'react';
import { InView } from 'react-intersection-observer';

import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';

import { Doc } from '../../doc-management';
import { useInfiniteSubDocs } from '../../doc-management/api/useSubDocs';

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
  } = useInfiniteSubDocs({
    page: 1,
    title: search,
    ...filters,
    parent_id: treeContext?.root?.id ?? '',
  });

  const loading = isFetching || isRefetching || isLoading;

  const docsData: QuickSearchData<Doc> = useMemo(() => {
    const subDocs = subDocsData?.pages.flatMap((page) => page.results) || [];

    return {
      groupName: subDocs.length > 0 ? t('Select a page') : '',
      elements: search ? subDocs : [],
      emptyString: t('No document found'),
      endActions: subDocsHasNextPage
        ? [
            {
              content: <InView onChange={() => void subDocsFetchNextPage()} />,
            },
          ]
        : [],
    };
  }, [search, subDocsData, subDocsFetchNextPage, subDocsHasNextPage]);

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
