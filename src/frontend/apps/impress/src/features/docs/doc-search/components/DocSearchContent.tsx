import { t } from 'i18next';
import { useEffect, useMemo } from 'react';
import { InView } from 'react-intersection-observer';

import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';
import { useInfiniteSearchDocs } from '@/docs/doc-management/api/useSearchDocs';
import { DocSearchTarget } from '@/docs/doc-search';

import { Doc } from '../../doc-management';

import { DocSearchItem } from './DocSearchItem';

type DocSearchContentProps = {
  search: string;
  onSelect: (doc: Doc) => void;
  onLoadingChange?: (loading: boolean) => void;
  renderElement?: (doc: Doc) => React.ReactNode;
  target?: DocSearchTarget;
  parentPath?: string;
  emptySearchText?: string;
};

export const DocSearchContent = ({
  search,
  onSelect,
  onLoadingChange,
  renderElement = (doc) => <DocSearchItem doc={doc} />,
  target,
  parentPath,
  emptySearchText,
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

  const docsData: QuickSearchData<Doc> = useMemo(() => {
    const docs = data?.pages.flatMap((page) => page.results) || [];
    const defaultEmptyText = emptySearchText || t('No document found');
    const emptyText = search ? defaultEmptyText : t('Search by title');

    return {
      groupName: docs.length > 0 ? t('Select a document') : '',
      elements: search ? docs : [],
      emptyString: target ? emptyText : defaultEmptyText,
      endActions: hasNextPage
        ? [
            {
              content: <InView onChange={() => void fetchNextPage()} />,
            },
          ]
        : [],
    };
  }, [
    search,
    data?.pages,
    fetchNextPage,
    hasNextPage,
    emptySearchText,
    target,
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
