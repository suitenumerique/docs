import { Button } from '@gouvfr-lasuite/cunningham-react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  XMark,
} from '@gouvfr-lasuite/ui-kit';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';

interface PresenterFloatingBarProps {
  index: number;
  total: number;
  isFullscreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
}

const barCss = css`
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  flex-direction: row !important;
  align-items: center;
  gap: 0.25rem;
  padding: var(--c--globals--spacings--3xs, 4px);
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--c--contextuals--content--semantic--neutral--secondary);
  border: 1px solid var(--c--contextuals--border--surface--primary);
  background: var(--c--contextuals--background--surface--primary);
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
`;

const separatorCss = css`
  width: 1px;
  height: 1.25rem;
  background: var(--c--theme--colors--greyscale-200, #e5e5e5);
  margin: 0 0.25rem;
`;

export const PresenterFloatingBar = ({
  index,
  total,
  isFullscreen,
  onPrev,
  onNext,
  onToggleFullscreen,
  onClose,
}: PresenterFloatingBarProps) => {
  const { t } = useTranslation();
  const isFirst = index <= 0;
  const isLast = index >= total - 1;

  return (
    <Box
      $direction="row"
      $align="center"
      $css={barCss}
      role="toolbar"
      aria-label={t('Presenter controls')}
    >
      <Button
        size="small"
        color="neutral"
        variant="tertiary"
        disabled={isFirst}
        onClick={onPrev}
        aria-label={t('Previous slide')}
        icon={<ChevronLeft />}
      />
      <Text
        as="span"
        $size="sm"
        $color="neutral"
        aria-label={t('Slide {{current}} of {{total}}', {
          current: index + 1,
          total,
        })}
      >
        {index + 1} / {total}
      </Text>
      <Button
        size="small"
        color="neutral"
        variant="tertiary"
        disabled={isLast}
        onClick={onNext}
        aria-label={t('Next slide')}
        icon={<ChevronRight />}
      />
      <Box $css={separatorCss} aria-hidden />
      <Button
        size="small"
        color="neutral"
        variant="tertiary"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? t('Exit fullscreen') : t('Enter fullscreen')}
        icon={<Maximize />}
      />
      <Button
        size="small"
        color="neutral"
        variant="tertiary"
        onClick={onClose}
        aria-label={t('Close presenter')}
        icon={<XMark />}
      />
    </Box>
  );
};
