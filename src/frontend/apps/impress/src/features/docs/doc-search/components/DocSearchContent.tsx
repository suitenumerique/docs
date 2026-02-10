import { t } from 'i18next';
import { useEffect, useMemo } from 'react';

import { QuickSearchData, QuickSearchGroup } from '@/components/quick-search';
import { useSearchDocs } from '@/docs/doc-management/api/searchDocs';

import { Doc } from '../../doc-management';

import { DocSearchFiltersValues } from './DocSearchFilters';
import { DocSearchItem } from './DocSearchItem';

type DocSearchContentProps = {
  search: string;
  filters: DocSearchFiltersValues;
  onSelect: (doc: Doc) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export const DocSearchContent = ({
  search,
  filters,
  onSelect,
  onLoadingChange,
}: DocSearchContentProps) => {
  const { data, isFetching, isRefetching, isLoading } = useSearchDocs({
    q: search,
    ...filters,
  });

  const loading = isFetching || isRefetching || isLoading;

  const docsData: QuickSearchData<Doc> = useMemo(() => {
    const docs = data?.results || [];

    return {
      groupName: docs.length > 0 ? t('Select a document') : '',
      elements: search ? docs : [],
      emptyString: t('No document found'),
    };
  }, [search, data?.results]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  return (
    <QuickSearchGroup
      onSelect={onSelect}
      group={docsData}
      renderElement={(doc) => <DocSearchItem doc={doc} />}
    />
  );
};
