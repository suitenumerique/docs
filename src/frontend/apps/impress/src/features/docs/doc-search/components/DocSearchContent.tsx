import { t } from 'i18next';
import { useEffect, useState } from 'react';
import { InView } from 'react-intersection-observer';

import { Box } from '@/components/';
import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';
import { useInfiniteSearchDocs } from '@/docs/doc-management/api/useSearchDocs';
import { DocSearchTarget } from '@/docs/doc-search';

import { Doc } from '../../doc-management';

import { DocSearchItem } from './DocSearchItem';

type DocSearchContentProps = {
  groupName: string;
  search: string;
  filterResults?: (doc: Doc) => boolean;
  isSearchNotMandatory?: boolean;
  onSelect: (doc: Doc) => void;
  onLoadingChange?: (loading: boolean) => void;
  target?: DocSearchTarget;
  parentPath?: string;
  renderSearchElement?: (doc: Doc) => React.ReactNode;
};

export const DocSearchContent = ({
  groupName,
  search,
  filterResults,
  onSelect,
  onLoadingChange,
  renderSearchElement,
  target,
  parentPath,
  isSearchNotMandatory,
}: DocSearchContentProps) => {
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
      target,
      parentPath,
    },
    {
      enabled: target !== DocSearchTarget.CURRENT || !!parentPath,
    },
  );

  const loading = isFetching || isRefetching || isLoading;
  const [docsData, setDocsData] = useState<QuickSearchData<Doc>>({
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

    setDocsData({
      groupName: docs.length > 0 ? groupName : '',
      groupKey: 'docs',
      elements: search || isSearchNotMandatory ? docs : [],
      emptyString: t('No document found'),
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
  }, [
    search,
    data?.pages,
    filterResults,
    groupName,
    isSearchNotMandatory,
    loading,
    hasNextPage,
    fetchNextPage,
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
