import { Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { useTreeContext } from '@gouvfr-lasuite/ui-kit';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import { Box, ButtonCloseModal, Text } from '@/components';
import { QuickSearch } from '@/components/quick-search';
import { Doc, useDocUtils } from '@/docs/doc-management';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useResponsiveStore } from '@/stores';

import { DocSearch } from '../api/useSearchDocs';
import EmptySearchIcon from '../assets/illustration-docs-empty.png';
import { useDocSearchFilterStore } from '../stores/useDocSearchFilterStore';
import { DocSearchFilterTypes } from '../types';

import { DocSearchContent } from './DocSearchContent';
import { DocSearchFilters } from './DocSearchFilters';

const ModalStyle = createGlobalStyle`
  .c__modal__scroller {
    overflow: inherit ;

    &:has(.quick-search-container) > div.c__modal__title {
      padding-top: var(--c--globals--spacings--sm);
      padding-bottom: var(--c--globals--spacings--xs);
      padding-inline: var(--c--globals--spacings--base);
    }
    .quick-search-input {
      padding: var(--c--globals--spacings--xxs) var(--c--globals--spacings--base);
    }
  }
`;

type DocSearchModalGlobalProps = {
  onClose: () => void;
  isOpen: boolean;
  showFilters?: boolean;
  defaultFilters: DocSearchFilterTypes;
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
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { isLargeScreen } = useResponsiveStore();
  const handleInputSearch = useDebouncedCallback(setSearch, 300);
  const { filter, setFilter } = useDocSearchFilterStore();

  useEffect(() => {
    if (!search) {
      setResults([]);
    }
  }, [search]);

  useEffect(() => {
    setFilter(defaultFilters);
  }, [defaultFilters, setFilter]);

  const handleSelect = (doc: Doc) => {
    void router.push(`/docs/${doc.id}`);
    modalProps.onClose?.();
  };

  /**
   * When searching within the current document, we only want to show sub-documents
   * Otherwise, we show all documents in the search results
   */
  const filterResults = useCallback(
    (doc: DocSearch) =>
      (filter === 'current' && !!doc.parent) || filter === 'all' || !filter,
    [filter],
  );

  return (
    <Modal
      {...modalProps}
      closeOnClickOutside
      size={isLargeScreen ? ModalSize.LARGE : ModalSize.FULL}
      hideCloseButton
      aria-label={t('Search for a document')}
      aria-labelledby="doc-search-modal-title"
      aria-describedby="doc-search-modal-description"
      title={
        <>
          <Text
            as="h2"
            $margin="0"
            $size="s"
            $align="flex-start"
            id="doc-search-modal-title"
          >
            {t('Search for a document')}
          </Text>
          <Text id="doc-search-modal-description" className="sr-only">
            {t(
              'Search documents by name, navigate using arrows, and select a result with Enter.',
            )}
          </Text>
          <Box $position="absolute" $css="top: 4px; right: 4px;">
            <ButtonCloseModal
              aria-label={t('Close the search modal')}
              onClick={modalProps.onClose}
            />
          </Box>
        </>
      }
    >
      <ModalStyle />
      <Box
        $direction="column"
        $justify="space-between"
        className="--docs--doc-search-modal"
        $padding={{ bottom: 'base' }}
      >
        <QuickSearch
          label={t('Type the name of a document')}
          placeholder={t('Type the name of a document')}
          loading={loading}
          onFilter={handleInputSearch}
          beforeList={
            <Box
              $margin={{ vertical: 'sm', horizontal: 'base' }}
              $justify="space-between"
              $direction="row"
              $align="center"
            >
              <Text
                $color="textSecondary"
                $weight="700"
                role="status"
                aria-live="polite"
              >
                <DocSearchStateText
                  hasResults={results.length > 0}
                  filter={filter}
                  isSearching={!!search}
                />
              </Text>
              {showFilters && <DocSearchFilters />}
            </Box>
          }
        >
          <Box
            $padding={{ horizontal: 'sm', bottom: 'base' }}
            $height={isLargeScreen ? '500px' : 'calc(100vh - 68px - 1rem)'}
          >
            {search.length === 0 && (
              <Box
                $direction="column"
                $height="100%"
                $align="center"
                $justify="center"
              >
                <Image width={320} src={EmptySearchIcon} alt="" priority />
              </Box>
            )}
            {search && (
              <DocSearchContent
                filterResults={filterResults}
                search={search}
                onSelect={handleSelect}
                onResults={setResults}
                onLoadingChange={setLoading}
                parentPath={filter === 'current' ? parentPath : undefined}
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

  return (
    <DocSearchModalGlobal
      {...modalProps}
      showFilters={isWithChildren && authenticated}
      defaultFilters={isWithChildren ? 'current' : 'all'}
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

interface DocSearchStateTextProps {
  hasResults: boolean;
  filter: DocSearchFilterTypes;
  isSearching: boolean;
}

const DocSearchStateText = ({
  hasResults,
  filter,
  isSearching,
}: DocSearchStateTextProps) => {
  const { t } = useTranslation();

  if (hasResults && filter === 'all') {
    return t('Select a document');
  }

  if (hasResults && filter === 'current') {
    return t('Select a sub-document');
  }

  if (isSearching && !hasResults) {
    return t('No documents found');
  }

  return null;
};
