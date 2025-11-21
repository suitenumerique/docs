import { PropsWithChildren } from 'react';

import { Box, BoxType } from '.';

export const Card = ({
  children,
  className,
  ...props
}: PropsWithChildren<BoxType>) => {
  return (
    <Box
      role="region"
      $withThemeBG
      $withThemeBorder
      className={`--docs--card ${className || ''}`}
      $radius="4px"
      $padding={{ horizontal: 'xs', vertical: '3xs' }}
      $scope="surface"
      $theme="primary"
      $variation=""
      {...props}
    >
      {children}
    </Box>
  );
};
