import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text, TextType } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import Pin from '../assets/pin.svg';

type DocIconProps = TextType & {
  emoji?: string | null;
  defaultIcon: React.ReactNode;
  isPinned?: boolean;
};

export const DocIcon = ({
  emoji,
  defaultIcon,
  isPinned = false,
  $size = 'sm',
  $variation = '1000',
  $weight = '400',
  ...textProps
}: DocIconProps) => {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();

  return (
    <Box
      $css={css`
        display: grid;
        grid-template-columns: 1fr;
        grid-template-rows: 1fr;
        place-items: center;
      `}
    >
      <Box
        $css={css`
          grid-column-start: 1;
          grid-row-start: 1;
        `}
      >
        {!emoji ? (
          <>{defaultIcon}</>
        ) : (
          <Text
            {...textProps}
            $size={$size}
            $variation={$variation}
            $weight={$weight}
            aria-hidden="true"
            aria-label={t('Document emoji icon')}
          >
            {emoji}
          </Text>
        )}
      </Box>
      {isPinned && (
        <Box
          $css={css`
            grid-column-start: 1;
            grid-row-start: 1;
            transform: translate(25%, -25%);
          `}
        >
          <Pin
            color={colorsTokens['primary-500']}
            aria-hidden="true"
            aria-label={t('Pin document icon')}
          />
        </Box>
      )}
    </Box>
  );
};
