import { LaGaufreV2 } from '@gouvfr-lasuite/ui-kit';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useConfig } from '@/core';

export const Waffle = () => {
  const { t } = useTranslation();
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

          .c__button--brand--tertiary svg path {
            fill: var(--c--contextuals--content--semantic--neutral--tertiary);
          }
        }
      `}
    >
      <LaGaufreV2
        {...waffleConfig}
        label={waffleConfig.label ?? t('Digital LaSuite services')}
        newWindowLabelSuffix={` (${t('new window')})`}
      />
    </Box>
  );
};
