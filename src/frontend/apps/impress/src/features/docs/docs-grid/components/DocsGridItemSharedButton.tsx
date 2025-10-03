import { Button, Tooltip } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { Doc } from '@/docs/doc-management';

type Props = {
  doc: Doc;
  handleClick: () => void;
  disabled: boolean;
};
export const DocsGridItemSharedButton = ({
  doc,
  handleClick,
  disabled,
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
        <Text $textAlign="center" $variation="000">
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
        style={{
          minWidth: '50px',
          justifyContent: 'center',
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleClick();
        }}
        color="tertiary"
        size="nano"
        icon={<Icon $theme="primary" iconName="group" disabled={disabled} />}
        disabled={disabled}
      >
        {sharedCount}
      </Button>
    </Tooltip>
  );
};
