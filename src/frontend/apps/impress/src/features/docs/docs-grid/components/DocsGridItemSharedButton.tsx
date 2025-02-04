import { Button, Tooltip } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';

import { Doc } from '../../doc-management';

type Props = {
  doc: Doc;
  handleClick: () => void;
};

export const DocsGridItemSharedButton = ({ doc, handleClick }: Props) => {
  const { t } = useTranslation();
  const sharedCount = doc.nb_accesses;
  const isShared = sharedCount - 1 > 0;

  if (!isShared) {
    return <Box $minWidth="50px">&nbsp;</Box>;
  }

  const tooltipContent = t('Shared with {{count}} users', {
    count: sharedCount,
  });

  return (
    <Tooltip
      content={
        <Text $variation="000" $textAlign="center">
          {tooltipContent}
        </Text>
      }
      placement="top"
    >
      <Button
        style={{ minWidth: '50px', justifyContent: 'center' }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleClick();
        }}
        color="tertiary"
        size="nano"
        aria-label={tooltipContent} // Lecture directe pour les lecteurs d'écran
      >
        <Icon
          $variation="800"
          $theme="primary"
          iconName="group"
          aria-hidden="true" // Empêche la lecture de l'icône
        />
        {sharedCount}
      </Button>
    </Tooltip>
  );
};
