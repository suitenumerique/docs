import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Card, IconBG, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { TableContent } from '@/features/docs/doc-table-content';
import { useResponsiveStore } from '@/stores';

import { useHeadingStore, usePanelEditorStore } from '../stores';

export const PanelEditor = () => {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const { isMobile } = useResponsiveStore();
  const { isPanelTableContentOpen, setIsPanelTableContentOpen, isPanelOpen } =
    usePanelEditorStore();

  return (
    <Card
      $width="100%"
      $maxWidth="20rem"
      $position={isMobile ? 'absolute' : 'sticky'}
      $height="100%"
      $hasTransition="slow"
      $css={`
        top: 0vh;
        right: 0;
        transform: translateX(0%);
        flex: 1;
        margin-left: 1rem;
        ${
          !isPanelOpen &&
          `
            transform: translateX(200%);
            opacity: 0;
            flex: 0;
            margin-left: 0rem;
            max-width: 0rem;
          `
        }
      `}
      aria-label={t('Document panel')}
      aria-hidden={!isPanelOpen}
    >
      <Box
        $overflow="inherit"
        $position="sticky"
        $hasTransition="slow"
        $css={`
          top: 0;
          opacity: ${isPanelOpen ? '1' : '0'};
        `}
        $maxHeight="99vh"
      >
        {isMobile && <IconOpenPanelEditor />}
        <Box
          $direction="row"
          $justify="space-between"
          $align="center"
          $position="relative"
          $background={colorsTokens()['primary-400']}
          $margin={{ bottom: 'tiny' }}
          $radius="4px 4px 0 0"
        >
          <Box
            $background="white"
            $position="absolute"
            $height="100%"
            $width="100%"
            $hasTransition="slow"
            $css={`
                border-top: 2px solid ${colorsTokens()['primary-600']};
                border-radius: 0 4px 0 0;
                ${
                  isPanelTableContentOpen
                    ? `
                      transform: translateX(0);
                      border-radius: 4px 0 0 0;
                    `
                    : `transform: translateX(100%);`
                }
              `}
          />
          <BoxButton
            $minWidth="100%"
            onClick={() => setIsPanelTableContentOpen(true)}
            $zIndex={1}
          >
            <Text
              $width="100%"
              $weight="bold"
              $size="m"
              $theme="primary"
              $variation="600"
              $padding={{ vertical: 'small', horizontal: 'small' }}
            >
              {t('Table of content')}
            </Text>
          </BoxButton>
        </Box>
        <TableContent />
      </Box>
    </Card>
  );
};

export const IconOpenPanelEditor = () => {
  const { headings } = useHeadingStore();
  const { t } = useTranslation();
  const { setIsPanelOpen, isPanelOpen, setIsPanelTableContentOpen } =
    usePanelEditorStore();
  const [hasBeenOpen, setHasBeenOpen] = useState(isPanelOpen);
  const { isMobile } = useResponsiveStore();

  const setClosePanel = () => {
    setHasBeenOpen(true);
    setIsPanelOpen(!isPanelOpen);
  };

  // Open the panel if there are more than 1 heading
  useEffect(() => {
    if (headings?.length && headings.length > 1 && !hasBeenOpen && !isMobile) {
      setIsPanelTableContentOpen(true);
      setIsPanelOpen(true);
      setHasBeenOpen(true);
    }
  }, [
    headings,
    setIsPanelTableContentOpen,
    setIsPanelOpen,
    hasBeenOpen,
    isMobile,
  ]);

  // If open from the doc header we set the state as well
  useEffect(() => {
    if (isPanelOpen && !hasBeenOpen) {
      setHasBeenOpen(true);
    }
  }, [hasBeenOpen, isPanelOpen]);

  // Close the panel unmount
  useEffect(() => {
    return () => {
      setIsPanelOpen(false);
    };
  }, [setIsPanelOpen]);

  return (
    <IconBG
      iconName="menu_open"
      aria-label={isPanelOpen ? t('Close the panel') : t('Open the panel')}
      $background="transparent"
      $size="h2"
      $zIndex={10}
      $hasTransition="slow"
      $css={`
        cursor: pointer;
        right: 0rem;
        top: 0.1rem;
        transform: rotate(${isPanelOpen ? '180deg' : '0deg'});
        user-select: none;
        ${hasBeenOpen ? 'display:flex;' : 'display: none;'}
      `}
      $position="absolute"
      onClick={setClosePanel}
      $radius="2px"
    />
  );
};
