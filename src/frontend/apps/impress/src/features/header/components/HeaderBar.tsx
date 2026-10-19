import { ReactNode } from 'react';

import { Box } from '@/components';

import { HEADER_ROW_MIN_HEIGHT } from '../conf';

import { HeaderLogoLink } from './HeaderLogoLink';

type HeaderBarProps = {
  actions?: ReactNode;
};

export const HeaderBar = ({ actions }: HeaderBarProps) => {
  return (
    <Box
      as="header"
      className="--docs--header-bar"
      $direction="row"
      $align="center"
      $justify="space-between"
      $width="100%"
      $shrink={0}
      $padding={{ horizontal: 'sm' }}
      $minHeight={HEADER_ROW_MIN_HEIGHT}
    >
      <HeaderLogoLink />
      {actions}
    </Box>
  );
};
