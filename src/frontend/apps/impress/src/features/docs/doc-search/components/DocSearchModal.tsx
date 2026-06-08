import { Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import { Box, ButtonCloseModal, Text } from '@/components';
import { QuickSearch } from '@/components/quick-search';
import { Doc, useDocUtils } from '@/docs/doc-management';
import {
  DocSearchFilters,
  DocSearchFiltersValues,
  DocSearchTarget,
} from '@/docs/doc-search';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useFocusStore, useResponsiveStore } from '@/stores';

import EmptySearchIcon from '../assets/illustration-docs-empty.png';

import { DocSearchContent } from './DocSearchContent';

const ModalStyle = createGlobalStyle`
  .c__modal__scroller {
    overflow: inherit ;
  }
`;

type DocSearchModalGlobalProps = {
  onClose: () => void;
  isOpen: boolean;
  showFilters?: boolean;
  defaultFilters?: DocSearchFiltersValues;
  parentPath?: string; // If defined, the search will be limited to the children of the document with the given path
};

const DocSearchModalGlobal = ({
  showFilters = false,
  defaultFilters,
  parentPath,
  ...modalProps
}: DocSearchModalGlobalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Doc[]>([]);
  const restoreFocus = useFocusStore((state) => state.restoreFocus);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DocSearchFiltersValues>(
    defaultFilters ?? {},
  );
  const { isLargeScreen } = useResponsiveStore();
  const handleInputSearch = useDebouncedCallback(setSearch, 300);

  const handleSelect = (doc: Doc) => {
    void router.push(`/docs/${doc.id}`);
    modalProps.onClose?.();
  };

  const handleResetFilters = () => {
    setFilters({});
    restoreFocus();
  };

  return (
    <Modal
      {...modalProps}
      closeOnClickOutside
      size={isLargeScreen ? ModalSize.LARGE : ModalSize.FULL}
      hideCloseButton
      aria-describedby="doc-search-modal-title"
    >
      <ModalStyle />
      <Box
        aria-label={t('Search modal')}
        $direction="column"
        $justify="space-between"
        className="--docs--doc-search-modal"
        $padding={{ vertical: 'base' }}
      >
        <Text
          as="h1"
          $margin="0"
          id="doc-search-modal-title"
          className="sr-only"
        >
          {t('Search docs')}
        </Text>
        <Box $position="absolute" $css="top: 4px; right: 4px;">
          <ButtonCloseModal
            aria-label={t('Close the search modal')}
            onClick={modalProps.onClose}
            size="small"
            color="brand"
            variant="tertiary"
          />
        </Box>
        <QuickSearch
          label={t('Search documents')}
          placeholder={t('Type the name of a document')}
          loading={loading}
          onFilter={handleInputSearch}
          beforeList={
            showFilters ? (
              <Box $padding={{ horizontal: '10px' }}>
                <DocSearchFilters
                  values={filters}
                  onValuesChange={setFilters}
                  onReset={handleResetFilters}
                />
              </Box>
            ) : undefined
          }
        >
          <Box
            $padding={{ horizontal: '10px', vertical: 'base' }}
            $height={isLargeScreen ? '500px' : 'calc(100vh - 68px - 1rem)'}
          >
            {search.length === 0 && (
              <Box
                $direction="column"
                $height="100%"
                $align="center"
                $justify="center"
              >
                <Image width={320} src={EmptySearchIcon} alt="" />
              </Box>
            )}
            {search && (
              <DocSearchContent
                groupName={results.length ? t('Select a document') : ''}
                search={search}
                onSelect={handleSelect}
                onResults={setResults}
                onLoadingChange={setLoading}
                target={
                  filters.target === DocSearchTarget.CURRENT
                    ? DocSearchTarget.CURRENT
                    : DocSearchTarget.ALL
                }
                parentPath={
                  filters.target === DocSearchTarget.CURRENT
                    ? parentPath
                    : undefined
                }
              />
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
  const treeContext = useTreeContext<Doc>();
  const { authenticated } = useAuth();

  let defaultFilters = DocSearchTarget.ALL;
  let showFilters = false;
  if (isWithChildren) {
    defaultFilters = DocSearchTarget.CURRENT;
    showFilters = authenticated;
  }

  return (
    <DocSearchModalGlobal
      {...modalProps}
      showFilters={showFilters}
      defaultFilters={{ target: defaultFilters }}
      parentPath={treeContext?.root?.path}
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
