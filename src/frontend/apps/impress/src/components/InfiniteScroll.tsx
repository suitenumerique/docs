import { Button } from '@openfun/cunningham-react';
import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { InView } from 'react-intersection-observer';

import { Box, BoxType, Icon } from '@/components';

interface InfiniteScrollProps extends BoxType {
  hasMore: boolean;
  isLoading: boolean;
  next: () => void;
  scrollContainer?: HTMLElement | null;
  buttonLabel?: string;
}

export const InfiniteScroll = ({
  children,
  hasMore,
  isLoading,
  next,
  buttonLabel,
  ...boxProps
}: PropsWithChildren<InfiniteScrollProps>) => {
  const { t } = useTranslation();
  const loadMore = (inView: boolean) => {
    if (!inView || isLoading) {
      return;
    }
    void next();
  };

  return (
    <Box {...boxProps}>
      {children}
      <InView onChange={loadMore}>
        {!isLoading && hasMore && (
          <Button
            onClick={() => void next()}
            color="primary-text"
            icon={<Icon iconName="arrow_downward" />}
          >
            {buttonLabel ?? t('Load more')}
          </Button>
        )}
      </InView>
    </Box>
  );
};
