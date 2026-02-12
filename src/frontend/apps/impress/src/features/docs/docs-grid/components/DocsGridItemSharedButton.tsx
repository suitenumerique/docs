import {
  Button,
  ButtonElement,
  Tooltip,
} from '@gouvfr-lasuite/cunningham-react';
import { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { Doc } from '@/docs/doc-management';

type Props = {
  doc: Doc;
  handleClick: () => void;
  disabled: boolean;
  buttonRef?: RefObject<ButtonElement | null>;
};
export const DocsGridItemSharedButton = ({
  doc,
  handleClick,
  disabled,
  buttonRef,
}: Props) => {
  const { t } = useTranslation();
  const sharedCount = doc.nb_accesses_direct;
  const isShared = sharedCount - 1 > 0;

  if (!isShared) {
    return <Box $minWidth="50px">&nbsp;</Box>;
  }

  return (
    <Tooltip
      content={
        <Text $textAlign="center">
          {t('Shared with {{count}} users', { count: sharedCount })}
        </Text>
      }
      placement="top"
      className="--docs--doc-tooltip-grid-item-shared-button"
    >
      <Button
        className="--docs--doc-grid-item-shared-button"
        aria-label={t('Open the sharing settings for the document')}
        data-testid={`docs-grid-item-shared-button-${doc.id}`}
        ref={buttonRef}
        style={{
          padding: `0 var(--c--globals--spacings--xxxs) 0 var(--c--globals--spacings--xxxs)`,
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleClick();
        }}
        color="brand"
        variant="secondary"
        size="nano"
        icon={
          <Icon
            $theme="brand"
            $variation="secondary"
            iconName="group"
            disabled={disabled}
            variant="filled"
          />
        }
        disabled={disabled}
      >
        {sharedCount}
      </Button>
    </Tooltip>
  );
};
