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
  hideGroupNameWhenEmpty?: boolean;
  search: string;
  filterResults?: (doc: DocSearch) => boolean;
  isSearchNotMandatory?: boolean;
  /** Keep only the first results, the next pages are then not loaded. */
  limit?: number;
  onResults?: (results: DocSearch[]) => void;
  onSelect: (doc: DocSearch) => void;
  onLoadingChange?: (loading: boolean) => void;
  parentDocId?: string;
  renderSearchElement?: (doc: DocSearch) => React.ReactNode;
  /** Let the parent announce the results to the screen readers. */
  silent?: boolean;
};

export const DocSearchContent = ({
  groupName,
  hideGroupNameWhenEmpty,
  search,
  filterResults,
  onResults,
  onSelect,
  onLoadingChange,
  renderSearchElement,
  parentDocId,
  isSearchNotMandatory,
  limit,
  silent,
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
      parentDocId,
    },
    {
      enabled: filter !== 'current' || !!parentDocId,
    },
  );

  const loading = isFetching || isRefetching || isLoading;
  const [docsData, setDocsData] = useState<QuickSearchData<DocSearch>>({
    groupName: '',
    groupKey: 'docs',
    elements: [],
    emptyString: t('Loading documents...', {
      description:
        'Placeholder and screen reader announcement while search results load',
    }),
    endActions: [],
  });

  useEffect(() => {
    if (loading) {
      if (!silent && (search || isSearchNotMandatory)) {
        announce(
          t('Loading documents...', {
            description:
              'Placeholder and screen reader announcement while search results load',
          }),
          'polite',
        );
      }
      return;
    }

    let docs = data?.pages.flatMap((page) => page.results) || [];

    if (filterResults) {
      docs = docs.filter(filterResults);
    }

    if (limit !== undefined) {
      docs = docs.slice(0, limit);
    }

    const elements = search || isSearchNotMandatory ? docs : [];

    onResults?.(elements);

    setDocsData({
      groupName:
        hideGroupNameWhenEmpty && elements.length === 0 ? '' : groupName,
      groupKey: 'docs',
      elements,
      endActions:
        hasNextPage && limit === undefined
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

    if (!silent && search && !loading) {
      announce(
        elements.length === 0
          ? t('No documents found', {
              description: 'Message when a search has no result',
            })
          : t('{{count}} document found', {
              description:
                'Screen reader announcement of the number of search results, plural form',
              count: elements.length,
            }),
        'polite',
      );
    }
  }, [
    search,
    data?.pages,
    filterResults,
    groupName,
    hideGroupNameWhenEmpty,
    isSearchNotMandatory,
    limit,
    loading,
    hasNextPage,
    fetchNextPage,
    onResults,
    silent,
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
