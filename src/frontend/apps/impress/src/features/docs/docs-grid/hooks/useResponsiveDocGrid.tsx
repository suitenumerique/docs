import { useMemo } from 'react';

import { useResponsiveStore } from '@/stores';

export const useResponsiveDocGrid = () => {
  const { isDesktop, screenWidth } = useResponsiveStore();

  const flexLeft = useMemo(() => {
    if (!isDesktop) {
      return 1;
    } else if (screenWidth <= 1100) {
      return 6;
    } else if (screenWidth < 1200) {
      return 8;
    }
    return 8;
  }, [isDesktop, screenWidth]);

  const flexRight = useMemo(() => {
    if (!isDesktop) {
      return undefined;
    } else if (screenWidth <= 1200) {
      return 5;
    }
    return 4;
  }, [isDesktop, screenWidth]);

  return { flexLeft, flexRight };
};
