import { LaGaufreV2, LaGaufreV2Props } from '@gouvfr-lasuite/ui-kit';
import React from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useConfig } from '@/core';

type WaffleAPIType = {
  apiUrl: LaGaufreV2Props['apiUrl'];
  data?: never;
};

type WaffleDataType = {
  apiUrl?: never;
  data?: LaGaufreV2Props['data'];
};

export type WaffleType = Omit<
  LaGaufreV2Props,
  'apiUrl' | 'data' | 'widgetPath'
> &
  (WaffleAPIType | WaffleDataType) & {
    widgetPath?: string;
  };

const LaGaufreV2Fixed = LaGaufreV2 as React.ComponentType<WaffleType>;

export const Waffle = () => {
  const { data: conf } = useConfig();

  const waffleConfig = conf?.theme_customization?.waffle;

  if (!waffleConfig?.apiUrl && !waffleConfig?.data) {
    return null;
  }

  return (
    <Box
      $css={css`
        & > div {
          display: flex;
        }
      `}
    >
      <LaGaufreV2Fixed {...waffleConfig} />
    </Box>
  );
};
