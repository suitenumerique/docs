import { Loader } from '@gouvfr-lasuite/cunningham-react';
import { useTranslation } from 'react-i18next';

import { Box, BoxProps } from './Box';
import { Icon } from './Icon';
import { Text } from './Text';

type LoadMoreTextProps = {
  ['data-testid']?: string;
};

export const LoadMoreText = ({
  'data-testid': dataTestId,
}: LoadMoreTextProps) => {
  const { t } = useTranslation();

  return (
    <Box
      data-testid={dataTestId}
      $direction="row"
      $align="center"
      $gap="0.4rem"
      $padding={{ horizontal: '2xs', vertical: 'sm' }}
      className="--docs--load-more"
    >
      <Icon
        $theme="brand"
        $variation="secondary"
        iconName="arrow_downward"
        $size="md"
      />
      <Text $theme="brand" $variation="secondary">
        {t('Load more')}
      </Text>
    </Box>
  );
};

export const Loading = (props: BoxProps) => (
  <Box $align="center" $justify="center" $height="100%" {...props}>
    <Loader />
  </Box>
);
