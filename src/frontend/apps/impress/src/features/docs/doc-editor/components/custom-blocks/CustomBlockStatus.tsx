import { Box, BoxType, Icon } from '@/components';

import Loader from '../../assets/loader.svg';
import Warning from '../../assets/warning.svg';

interface CustomBlockStatusProps extends BoxType {
  type?: 'loading' | 'warning';
}

export const CustomBlockStatus = ({
  type = 'warning',
  children,
  ...props
}: CustomBlockStatusProps) => {
  return (
    <Box
      $direction="row"
      $gap="0.5rem"
      $width="inherit"
      $css="pointer-events: none;"
      contentEditable={false}
      draggable={false}
      {...props}
    >
      {type === 'warning' ? (
        <Warning style={{ flexShrink: 0 }} aria-hidden="true" />
      ) : (
        <Icon
          $theme="brand"
          $layer="border"
          icon={
            <Loader
              style={{ animation: 'spin 1.5s linear infinite' }}
              aria-hidden="true"
            />
          }
          $shrink={0}
        />
      )}
      {children}
    </Box>
  );
};
