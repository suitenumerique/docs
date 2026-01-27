import { Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';

import { Box, ButtonCloseModal, Text } from '@/components';
import { QuickSearch } from '@/components/quick-search';
import { Doc, useDocUtils } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import EmptySearchIcon from '../assets/illustration-docs-empty.png';

import { DocSearchContent } from './DocSearchContent';
import {
  DocSearchFilters,
  DocSearchFiltersValues,
  DocSearchTarget,
} from './DocSearchFilters';
import { DocSearchItem } from './DocSearchItem';
import { DocSearchSubPageContent } from './DocSearchSubPageContent';

type DocSearchModalGlobalProps = {
  onClose: () => void;
  isOpen: boolean;
  showFilters?: boolean;
  defaultFilters?: DocSearchFiltersValues;
};

const DocSearchModalGlobal = ({
  showFilters = false,
  defaultFilters,
  ...modalProps
}: DocSearchModalGlobalProps) => {
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
      hideCloseButton
      aria-describedby="doc-search-modal-title"
    >
      <Box
        aria-label={t('Search modal')}
        $direction="column"
        $justify="space-between"
        className="--docs--doc-search-modal"
      >
        <Text
          as="h1"
          $margin="0"
          id="doc-search-modal-title"
          className="sr-only"
        >
          {t('Search docs')}
        </Text>
        <Box $position="absolute" $css="top: 12px; right: 12px;">
          <ButtonCloseModal
            aria-label={t('Close the search modal')}
            onClick={modalProps.onClose}
            size="small"
            color="brand"
            variant="tertiary"
          />
        </Box>
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
                    onSelect={handleSelect}
                    onLoadingChange={setLoading}
                  />
                )}
                {isDocPage && target === DocSearchTarget.CURRENT && (
                  <DocSearchSubPageContent
                    search={search}
                    onSelect={handleSelect}
                    onLoadingChange={setLoading}
                    renderElement={(doc) => <DocSearchItem doc={doc} />}
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

type DocSearchModalDetailProps = DocSearchModalGlobalProps & {
  doc: Doc;
};

const DocSearchModalDetail = ({
  doc,
  ...modalProps
}: DocSearchModalDetailProps) => {
  const { hasChildren, isChild } = useDocUtils(doc);
  const isWithChildren = isChild || hasChildren;

  let defaultFilters = DocSearchTarget.ALL;
  let showFilters = false;
  if (isWithChildren) {
    defaultFilters = DocSearchTarget.CURRENT;
    showFilters = true;
  }

  return (
    <DocSearchModalGlobal
      {...modalProps}
      showFilters={showFilters}
      defaultFilters={{ target: defaultFilters }}
    />
  );
};

type DocSearchModalProps = DocSearchModalGlobalProps & {
  doc?: Doc;
};

export const DocSearchModal = ({ doc, ...modalProps }: DocSearchModalProps) => {
  if (doc) {
    return <DocSearchModalDetail doc={doc} {...modalProps} />;
  }

  return <DocSearchModalGlobal {...modalProps} />;
};
