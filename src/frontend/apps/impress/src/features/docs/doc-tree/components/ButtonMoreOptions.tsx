import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Icon } from '@/components';

type ButtonMoreOptionsProps = {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  title?: string | null;
  className?: string;
};

export const ButtonMoreOptions = ({
  isOpen,
  onOpenChange,
  title,
  className = 'icon-button',
}: ButtonMoreOptionsProps) => {
  const { t } = useTranslation();

  const preventDefaultAndStopPropagation = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
    },
    [],
  );

  const isValidKeyEvent = useCallback((e: React.KeyboardEvent) => {
    return e.key === 'Enter' || e.key === ' ';
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      preventDefaultAndStopPropagation(e);
      onOpenChange?.(!isOpen);
    },
    [isOpen, onOpenChange, preventDefaultAndStopPropagation],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isValidKeyEvent(e)) {
        preventDefaultAndStopPropagation(e);
        onOpenChange?.(!isOpen);
      }
    },
    [isOpen, onOpenChange, preventDefaultAndStopPropagation, isValidKeyEvent],
  );

  return (
    <Icon
      onClick={handleClick}
      iconName="more_horiz"
      variant="filled"
      $theme="primary"
      $variation="600"
      className={className}
      tabIndex={-1}
      role="button"
      aria-label={t('More options for {{title}}', {
        title: title || t('Untitled document'),
      })}
      aria-haspopup="true"
      aria-expanded={isOpen}
      onKeyDown={handleKeyDown}
      $css={css`
        cursor: pointer;
      `}
    />
  );
};
