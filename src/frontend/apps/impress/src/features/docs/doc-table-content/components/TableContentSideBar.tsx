import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import TableContentIcon from '@/assets/icons/ui-kit/bulleted-list.svg';
import { Box, ButtonCloseModal, Text } from '@/components';
import { useRightPanelStore } from '@/features/right-panel/components/useRightPanelStore';

interface TableContentSideBarProps {
  onClose: () => void;
}

export const TableContentSideBar = ({ onClose }: TableContentSideBarProps) => {
  const { t } = useTranslation();

  return (
    <Box $height="inherit">
      <Box
        $padding={{ vertical: 'base', horizontal: 'sm' }}
        $css={css`
          border-bottom: 1px solid
            var(--c--contextuals--border--surface--primary);
        `}
      >
        <Box $direction="row" $align="center" $justify="space-between">
          <Text $weight="bold">{t('Table of Contents')}</Text>
          <ButtonCloseModal
            aria-label={t('Close the table of contents sidebar')}
            onClick={onClose}
          />
        </Box>
      </Box>
    </Box>
  );
};

export const TableContentSideBarButton = () => {
  const { t } = useTranslation();
  const { isPanelOpen, activePanel, setActivePanel, setIsPanelOpen } =
    useRightPanelStore();

  const isActive = isPanelOpen && activePanel === 'tableContent';
  const ariaLabel = isActive
    ? t('Hide the table of contents sidebar')
    : t('Show the table of contents sidebar');

  return (
    <Button
      size="small"
      onClick={() => {
        if (isActive) {
          setIsPanelOpen(false);
        } else {
          setActivePanel('tableContent');
        }
      }}
      aria-label={ariaLabel}
      aria-expanded={isActive}
      color="neutral"
      variant={isActive ? 'secondary' : 'tertiary'}
      icon={<TableContentIcon width={24} height={24} aria-hidden="true" />}
    ></Button>
  );
};
