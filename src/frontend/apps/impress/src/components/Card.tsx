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
      $scope={props.$theme ? props.$scope || 'semantic' : 'surface'}
      $theme={props.$theme || 'primary'}
      $variation={props.$theme ? props.$variation || 'tertiary' : ''}
      {...props}
    >
      {children}
    </Box>
  );
};
