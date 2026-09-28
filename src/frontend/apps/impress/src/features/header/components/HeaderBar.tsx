import { Box } from '@/components';

import { HEADER_ROW_MIN_HEIGHT } from '../conf';

import { HeaderLogoLink } from './HeaderLogoLink';

export const HeaderBar = () => {
  return (
    <Box
      as="header"
      className="--docs--header-bar"
      $direction="row"
      $align="center"
      $width="100%"
      $shrink={0}
      $padding={{ horizontal: 'sm' }}
      $minHeight={HEADER_ROW_MIN_HEIGHT}
    >
      <HeaderLogoLink />
    </Box>
  );
};
