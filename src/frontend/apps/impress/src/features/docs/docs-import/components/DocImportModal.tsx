import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import Image from 'next/image';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import { Box, ButtonCloseModal, Text } from '@/components';
import { QuickSearch } from '@/components/quick-search';
import { Doc, useTrans } from '@/docs/doc-management';
import { useResponsiveStore } from '@/stores';

import { DocSearchTarget } from '../../doc-search';
import { DocSearchContent } from '../../doc-search/components/DocSearchContent';
import EmptySearchIcon from '../assets/illustration-docs-empty.png';

export const DocImportModalStyle = createGlobalStyle`
  .c__modal__title {
    border-bottom: 1px solid var(--c--contextuals--border--surface--primary);
  }
`;

type DocImportModalGlobalProps = {
  doc: Doc;
  isOpen: boolean;
  onClose: () => void;
};

export const DocImportModal = ({
  doc,
  isOpen,
  onClose,
}: DocImportModalGlobalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { untitledDocument } = useTrans();
  const docTitle = doc.title || untitledDocument;

  const [search, setSearch] = useState('');
  const [docSelected, setDocSelected] = useState<Doc>();

  const { isDesktop } = useResponsiveStore();

  const handleInputSearch = useDebouncedCallback(setSearch, 300);

  const handleSelect = (doc: Doc) => {
    setDocSelected(doc);
  };

  return (
    <>
      <DocImportModalStyle />
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        closeOnClickOutside
        size={isDesktop ? ModalSize.LARGE : ModalSize.FULL}
        hideCloseButton
        rightActions={
          <>
            <Button
              aria-label={t('Cancel the move')}
              variant="secondary"
              fullWidth
              //onClick={() => onClose()}
            >
              {t('Cancel')}
            </Button>
            <Button
              // aria-label={
              //   format === DocDownloadFormat.PRINT ? t('Print') : t('Download')
              // }
              variant="primary"
              fullWidth
              //onClick={() => void onSubmit()}
              //disabled={isExporting}
            >
              {t('Move here')}
            </Button>
          </>
        }
        title={
          <Box>
            <Box
              $direction="row"
              $justify="space-between"
              $align="center"
              $width="100%"
            >
              <Text as="h2" $margin="0" $size="h6" $align="flex-start">
                {t('Move')}
              </Text>
              <ButtonCloseModal
                aria-label={t('Close the move modal')}
                onClick={() => onClose()}
              />
            </Box>
            <Box $margin={{ top: 'sm' }}>
              <Text
                $size="sm"
                $variation="secondary"
                $display="inline"
                $weight="normal"
              >
                <Trans t={t}>
                  Choose the new location for <strong>{docTitle}</strong>.
                </Trans>
              </Text>
            </Box>
          </Box>
        }
      >
        <Box
          aria-label={t('Move modal')}
          $direction="column"
          $justify="space-between"
          className="--docs--doc-move-modal"
        >
          <QuickSearch
            placeholder={t('Search for a doc')}
            loading={loading}
            onFilter={handleInputSearch}
          >
            <Box
              $padding={{ horizontal: '10px' }}
              $height={isDesktop ? '500px' : 'calc(100vh - 68px - 1rem)'}
            >
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
                <DocSearchContent
                  search={search}
                  filters={{ target: DocSearchTarget.ALL }}
                  onSelect={handleSelect}
                  onLoadingChange={setLoading}
                />
              )}
            </Box>
          </QuickSearch>
        </Box>
      </Modal>
    </>
  );
};
