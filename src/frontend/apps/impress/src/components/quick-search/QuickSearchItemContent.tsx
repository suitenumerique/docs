import { ReactNode } from 'react';

import { useCunninghamTheme } from '@/cunningham';

import { Box } from '../Box';

export type QuickSearchItemContentProps = {
  alwaysShowRight?: boolean;
  left: ReactNode;
  right?: ReactNode;
};

export const QuickSearchItemContent = ({
  alwaysShowRight = false,
  left,
  right,
}: QuickSearchItemContentProps) => {
  const { spacingsTokens } = useCunninghamTheme();

  return (
    <Box
      className="--docs--quick-search-item-content"
      $direction="row"
      $align="center"
      $padding={{ horizontal: 'xs', vertical: '3xs' }}
      $justify="space-between"
      $minHeight="34px"
      $width="100%"
      $gap="sm"
    >
      <Box
        className="--docs--quick-search-item-content-left"
        $direction="row"
        $align="center"
        $gap={spacingsTokens['2xs']}
      >
        {left}
      </Box>

      {right && (
        <Box
          className={`--docs--quick-search-item-content-right ${!alwaysShowRight ? 'show-right-on-focus' : ''}`}
          $direction="row"
          $align="center"
        >
          {right}
        </Box>
      )}
    </Box>
  );
};
