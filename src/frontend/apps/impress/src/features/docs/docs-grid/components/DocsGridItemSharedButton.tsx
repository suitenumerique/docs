import { Tooltip } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { Doc } from '@/docs/doc-management';

type Props = {
  doc: Doc;
  disabled: boolean;
};

/**
 * Read-only sharing indicator: sharing is managed in Drive, so this badge
 * only displays the number of accesses known by Drive.
 */
export const DocsGridItemSharedButton = ({ doc, disabled }: Props) => {
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
      <Box
        className="--docs--doc-grid-item-shared-button"
        $direction="row"
        $align="center"
        $gap="2px"
        style={{
          padding: `0 var(--c--globals--spacings--xxxs)`,
        }}
      >
        <Icon
          $theme="brand"
          $variation="secondary"
          iconName="group"
          disabled={disabled}
          variant="filled"
        />
        <Text $theme="brand" $variation="secondary" $size="xs">
          {sharedCount}
        </Text>
      </Box>
    </Tooltip>
  );
};
