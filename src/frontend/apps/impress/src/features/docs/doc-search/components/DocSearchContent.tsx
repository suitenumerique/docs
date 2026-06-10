import { announce } from '@react-aria/live-announcer';
import { t } from 'i18next';
import { useEffect, useState } from 'react';
import { InView } from 'react-intersection-observer';

import { Box } from '@/components/';
import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';

import { DocSearch, useInfiniteSearchDocs } from '../api/useSearchDocs';
import { useDocSearchFilterStore } from '../stores/useDocSearchFilterStore';

import { DocSearchItem } from './DocSearchItem';

type DocSearchContentProps = {
  groupName?: string;
  search: string;
  filterResults?: (doc: DocSearch) => boolean;
  isSearchNotMandatory?: boolean;
  onResults?: (results: DocSearch[]) => void;
  onSelect: (doc: DocSearch) => void;
  onLoadingChange?: (loading: boolean) => void;
  parentPath?: string;
  renderSearchElement?: (doc: DocSearch) => React.ReactNode;
};

export const DocSearchContent = ({
  groupName,
  search,
  filterResults,
  onResults,
  onSelect,
  onLoadingChange,
  renderSearchElement,
  parentPath,
  isSearchNotMandatory,
}: DocSearchContentProps) => {
  const { filter } = useDocSearchFilterStore();
  const {
    data,
    isFetching,
    isRefetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteSearchDocs(
    {
      q: search,
      page: 1,
      filter,
      parentPath,
    },
    {
      enabled: filter !== 'current' || !!parentPath,
    },
  );

  const loading = isFetching || isRefetching || isLoading;
  const [docsData, setDocsData] = useState<QuickSearchData<DocSearch>>({
    groupName: '',
    groupKey: 'docs',
    elements: [],
    emptyString: t('Loading documents...'),
    endActions: [],
  });

  useEffect(() => {
    if (loading) {
      return;
    }

    let docs = data?.pages.flatMap((page) => page.results) || [];

    if (filterResults) {
      docs = docs.filter(filterResults);
    }

    const elements = search || isSearchNotMandatory ? docs : [];

    onResults?.(elements);

    setDocsData({
      groupName: groupName,
      groupKey: 'docs',
      elements,
      endActions: hasNextPage
        ? [
            {
              content: (
                <Box $minHeight="1px">
                  <InView onChange={() => void fetchNextPage()} />
                </Box>
              ),
            },
          ]
        : [],
    });

    if (search && !loading) {
      announce(
        elements.length === 0
          ? t('No documents found')
          : t('{{count}} document found', { count: elements.length }),
        'polite',
      );
    }
  }, [
    search,
    data?.pages,
    filterResults,
    groupName,
    isSearchNotMandatory,
    loading,
    hasNextPage,
    fetchNextPage,
    onResults,
  ]);

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
