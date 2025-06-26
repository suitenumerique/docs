import { Modal, ModalSize } from '@openfun/cunningham-react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';

import { Box } from '@/components';
import { QuickSearch } from '@/components/quick-search';
import { useResponsiveStore } from '@/stores';

import { Doc } from '../../doc-management';
import EmptySearchIcon from '../assets/illustration-docs-empty.png';

import { DocSearchContent } from './DocSearchContent';
import {
  DocSearchFilters,
  DocSearchFiltersValues,
  DocSearchTarget,
} from './DocSearchFilters';
import { DocSearchSubPageContent } from './DocSearchSubPageContent';

type DocSearchModalProps = {
  onClose: () => void;
  isOpen: boolean;
  showFilters?: boolean;
  defaultFilters?: DocSearchFiltersValues;
};

export const DocSearchModal = ({
  showFilters = false,
  defaultFilters,
  ...modalProps
}: DocSearchModalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const isDocPage = router.pathname === '/docs/[id]';

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DocSearchFiltersValues>(
    defaultFilters ?? {},
  );

  const target = filters.target ?? DocSearchTarget.ALL;
  const { isDesktop } = useResponsiveStore();

  const handleInputSearch = useDebouncedCallback(setSearch, 300);

  const handleSelect = (doc: Doc) => {
    void router.push(`/docs/${doc.id}`);
    modalProps.onClose?.();
  };

  const handleResetFilters = () => {
    setFilters({});
  };

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
        className="--docs--doc-search-modal"
      >
        <QuickSearch
          placeholder={t('Type the name of a document')}
          loading={loading}
          onFilter={handleInputSearch}
        >
          <Box
            $padding={{ horizontal: '10px' }}
            $height={isDesktop ? '500px' : 'calc(100vh - 68px - 1rem)'}
          >
            {showFilters && (
              <DocSearchFilters
                values={filters}
                onValuesChange={setFilters}
                onReset={handleResetFilters}
              />
            )}
            {search.length === 0 && (
              <Box
                $direction="column"
                $height="100%"
                $align="center"
                $justify="center"
              >
                <Image
                  className="c__image-system-filter"
                  width={320}
                  src={EmptySearchIcon}
                  alt={t('No active search')}
                />
              </Box>
            )}
            {search && (
              <>
                {target === DocSearchTarget.ALL && (
                  <DocSearchContent
                    search={search}
                    filters={filters}
                    onSelect={handleSelect}
                    onLoadingChange={setLoading}
                  />
                )}
                {isDocPage && target === DocSearchTarget.CURRENT && (
                  <DocSearchSubPageContent
                    search={search}
                    filters={filters}
                    onSelect={handleSelect}
                    onLoadingChange={setLoading}
                  />
                )}
              </>
            )}
          </Box>
        </QuickSearch>
      </Box>
    </Modal>
  );
};
