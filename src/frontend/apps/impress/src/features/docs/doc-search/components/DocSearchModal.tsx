import { Modal, ModalProps, ModalSize } from '@openfun/cunningham-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InView } from 'react-intersection-observer';
import { useDebouncedCallback } from 'use-debounce';

import { Box } from '@/components';
import {
  QuickSearch,
  QuickSearchData,
  QuickSearchGroup,
} from '@/components/quick-search';
import { Doc, useInfiniteDocs } from '@/features/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import EmptySearchIcon from '../assets/illustration-docs-empty.png';

import { DocSearchItem } from './DocSearchItem';

type DocSearchModalProps = ModalProps & {};

export const DocSearchModal = ({ ...modalProps }: DocSearchModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { isDesktop } = useResponsiveStore();
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
  });
  const loading = isFetching || isRefetching || isLoading;
  const handleInputSearch = useDebouncedCallback(setSearch, 300);

  const handleSelect = (doc: Doc) => {
    router.push(`/docs/${doc.id}`);
    modalProps.onClose?.();
  };

  const docsData: QuickSearchData<Doc> = useMemo(() => {
    const docs = data?.pages.flatMap((page) => page.results) || [];

    return {
      groupName: docs.length > 0 ? t('Select a document') : '',
      elements: search ? docs : [],
      emptyString: t('No document found'),
      endActions: hasNextPage
        ? [{ content: <InView onChange={() => void fetchNextPage()} /> }]
        : [],
    };
  }, [data, hasNextPage, fetchNextPage, t, search]);

  return (
    <Modal
      {...modalProps}
      closeOnClickOutside
      size={isDesktop ? ModalSize.LARGE : ModalSize.FULL}
    >
      <Box
        aria-label={t('Search modal')}
        $direction="column"
        $justify="space-between"
      >
        <QuickSearch
          placeholder={t('Type the name of a document')}
          loading={loading}
          onFilter={handleInputSearch}
        >
          <Box $height={isDesktop ? '500px' : 'calc(100vh - 68px - 1rem)'}>
            {search.length === 0 && (
              <Box
                $direction="column"
                $height="100%"
                $align="center"
                $justify="center"
              >
                <Image
                  width={320}
                  src={EmptySearchIcon}
                  alt={t('No active search')}
                />
              </Box>
            )}
            {search && (
              <QuickSearchGroup
                onSelect={handleSelect}
                group={docsData}
                renderElement={(doc) => <DocSearchItem doc={doc} />}
              />
            )}
          </Box>
        </QuickSearch>
      </Box>
    </Modal>
  );
};
