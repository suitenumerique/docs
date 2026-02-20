import { t } from 'i18next';
import { useEffect, useMemo } from 'react';
import { InView } from 'react-intersection-observer';

import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';

import { Doc, useInfiniteDocs } from '../../doc-management';

import { DocSearchFiltersValues } from './DocSearchFilters';
import { DocSearchItem } from './DocSearchItem';

type DocSearchContentProps = {
  search: string;
  filters: DocSearchFiltersValues;
  filterResults?: (doc: Doc) => boolean;
  onSelect: (doc: Doc) => void;
  onLoadingChange?: (loading: boolean) => void;
  renderSearchElement?: (doc: Doc) => React.ReactNode;
};

export const DocSearchContent = ({
  search,
  filters,
  filterResults,
  onSelect,
  onLoadingChange,
  renderSearchElement,
}: DocSearchContentProps) => {
  const {
    data,
    isFetching,
    isRefetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteDocs({
    page: 1,
    title: search,
    ...filters,
  });

  const loading = isFetching || isRefetching || isLoading;

  const docsData: QuickSearchData<Doc> = useMemo(() => {
    let docs = data?.pages.flatMap((page) => page.results) || [];

    if (filterResults) {
      docs = docs.filter(filterResults);
    }

    return {
      groupName: docs.length > 0 ? t('Select a document') : '',
      groupKey: 'docs',
      elements: search ? docs : [],
      emptyString: t('No document found'),
      endActions: hasNextPage
        ? [
            {
              content: <InView onChange={() => void fetchNextPage()} />,
            },
          ]
        : [],
    };
  }, [search, data?.pages, fetchNextPage, hasNextPage, filterResults]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  return (
    <QuickSearchGroup
      onSelect={onSelect}
      group={docsData}
      renderElement={
        renderSearchElement ?? ((doc) => <DocSearchItem doc={doc} />)
      }
    />
  );
};
