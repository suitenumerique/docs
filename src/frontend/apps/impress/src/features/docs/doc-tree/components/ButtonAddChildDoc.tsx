import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { BoxButton, Icon } from '@/components';

type ButtonAddChildDocProps = {
  onCreateChild: (params: { parentId: string }) => void;
  parentId: string;
  title?: string | null;
};

export const ButtonAddChildDoc = ({
  onCreateChild,
  parentId,
  title,
}: ButtonAddChildDocProps) => {
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
      void onCreateChild({ parentId });
    },
    [onCreateChild, parentId, preventDefaultAndStopPropagation],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isValidKeyEvent(e)) {
        preventDefaultAndStopPropagation(e);
        void onCreateChild({ parentId });
      }
    },
    [
      onCreateChild,
      parentId,
      preventDefaultAndStopPropagation,
      isValidKeyEvent,
    ],
  );

  return (
    <BoxButton
      as="button"
      tabIndex={-1}
      data-testid="add-child-doc"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      color="primary"
      aria-label={t('Add child document to {{title}}', {
        title: title || t('Untitled document'),
      })}
      $hasTransition={false}
    >
      <Icon
        variant="filled"
        $variation="800"
        $theme="primary"
        iconName="add_box"
        aria-hidden="true"
      />
    </BoxButton>
  );
};
