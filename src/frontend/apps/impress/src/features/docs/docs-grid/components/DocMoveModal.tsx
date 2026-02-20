import { Button, Modal, ModalSize } from '@gouvfr-lasuite/cunningham-react';
import { TreeViewMoveModeEnum } from '@gouvfr-lasuite/ui-kit';
import Image from 'next/image';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { createGlobalStyle, css } from 'styled-components';
import { useDebouncedCallback } from 'use-debounce';

import { Box, ButtonCloseModal, Text } from '@/components';
import { QuickSearch } from '@/components/quick-search';
import { Doc, useMoveDoc, useTrans } from '@/docs/doc-management';
import { DocSearchContent, DocSearchTarget } from '@/docs/doc-search';
import EmptySearchIcon from '@/docs/doc-search/assets/illustration-docs-empty.png';
import { useResponsiveStore } from '@/stores';

import { DocsGridItemDate, DocsGridItemTitle } from './DocsGridItem';

export const DocMoveModalStyle = createGlobalStyle`
  .c__modal--full .c__modal__scroller {
    height: 100vh;
  }

  .c__modal__scroller:has(.quick-search-container){
    display: flex;
    flex-direction: column;

    .quick-search-container [cmdk-list] {
      overflow-y: auto;
    }

    .c__modal__title {
      padding-inline: var(--c--globals--spacings--md);
      padding-block: var(--c--globals--spacings--base);
      border-bottom: 1px solid var(--c--contextuals--border--surface--primary);
    }
    .c__modal__footer {
      margin-top: 0rem;
    }
    .quick-search-input{
      padding-inline: var(--c--globals--spacings--md);
    }
    .c__modal__footer{
      border-top: 1px solid var(--c--contextuals--border--surface--primary);
    }
    .quick-search-container [cmdk-item] {
      border-radius: 4px;
    }
    .quick-search-container [cmdk-item][data-selected='true'] {
      background: var(--c--contextuals--background--semantic--contextual--primary);
    }
  }
`;

type DocMoveModalGlobalProps = {
  doc: Doc;
  isOpen: boolean;
  onClose: () => void;
};

export const DocMoveModal = ({
  doc,
  isOpen,
  onClose,
}: DocMoveModalGlobalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [docSelected, setDocSelected] = useState<Doc>();
  const { untitledDocument } = useTrans();
  const docTitle = doc.title || untitledDocument;
  const { mutate: moveDoc } = useMoveDoc(true);
  const [search, setSearch] = useState('');
  const { isDesktop } = useResponsiveStore();
  const handleInputSearch = useDebouncedCallback(setSearch, 700);

  const handleSelect = (docSelected: Doc) => {
    setDocSelected(docSelected);
  };

  const handleMoveDoc = () => {
    if (!docSelected?.id) {
      return;
    }

    moveDoc({
      sourceDocumentId: doc.id,
      targetDocumentId: docSelected.id,
      position: TreeViewMoveModeEnum.FIRST_CHILD,
    });
  };

  return (
    <>
      <DocMoveModalStyle />
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        closeOnClickOutside
        size={isDesktop ? ModalSize.LARGE : ModalSize.FULL}
        hideCloseButton
        aria-label={t('Move Modal')}
        rightActions={
          <Box $direction="row-reverse" $padding="md" $gap="small">
            <Button
              aria-label={t('Move the document to the selected location')}
              variant="primary"
              fullWidth
              onClick={() => {
                handleMoveDoc();
              }}
              disabled={!docSelected}
            >
              {t('Move here')}
            </Button>
            <Button
              aria-label={t('Cancel the move')}
              variant="secondary"
              fullWidth
              onClick={onClose}
            >
              {t('Cancel')}
            </Button>
          </Box>
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
                $textAlign="left"
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
          onKeyDown={(e) => {
            // Close modal on Escape
            if (e.key === 'Escape') {
              onClose();
              return;
            }
            // Prevent keyboard events from bubbling to parent components (e.g., drag and drop)
            e.stopPropagation();
          }}
        >
          <QuickSearch
            placeholder={t('Search for a doc')}
            loading={loading}
            onFilter={handleInputSearch}
          >
            <Box
              $padding={{ horizontal: 'md' }}
              $height={isDesktop ? 'min(60vh, 500px)' : 'calc(100vh - 260px)'}
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
                    style={{ maxWidth: '100%', height: 'auto' }}
                    priority
                  />
                </Box>
              )}
              {search && (
                <Box>
                  <DocSearchContent
                    search={search}
                    filters={{ target: DocSearchTarget.ALL }}
                    filterResults={(docResults) =>
                      docResults.id !== doc.id && docResults.abilities.move
                    }
                    onSelect={handleSelect}
                    onLoadingChange={setLoading}
                    renderSearchElement={(docSearch) => {
                      const isSelected = docSelected?.id === docSearch.id;

                      return (
                        <Box
                          className="--docs--doc-move-modal-search-item"
                          $direction="row"
                          $align="center"
                          $justify="space-between"
                          $width="100%"
                          $gap="sm"
                          $padding="3xs"
                          $css={css`
                            background-color: ${isSelected
                              ? 'var(--c--contextuals--background--semantic--brand--tertiary)'
                              : 'transparent'};
                            border: 1px solid
                              ${isSelected
                                ? 'var(--c--contextuals--border--semantic--brand--tertiary)'
                                : 'transparent'};
                            border-radius: var(--c--globals--spacings--3xs);

                            /* Arrow key navigation highlight */
                            &[data-selected='true'] {
                              ${!isSelected &&
                              `
                                background-color: var(--c--contextuals--background--semantic--contextual--primary);
                                border-color: transparent;
                              `}
                            }
                          `}
                          aria-selected={isSelected}
                        >
                          <DocsGridItemTitle
                            doc={docSearch}
                            withTooltip={false}
                          />
                          <DocsGridItemDate
                            doc={docSearch}
                            isDesktop={isDesktop}
                            isInTrashbin={false}
                          />
                        </Box>
                      );
                    }}
                  />
                </Box>
              )}
            </Box>
          </QuickSearch>
        </Box>
      </Modal>
    </>
  );
};
