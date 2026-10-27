import { css } from 'styled-components';

import { Box, Icon, Loading } from '@/components';

interface EncryptedMediaPlaceholderProps {
  label: string;
  errorLabel: string;
  minHeight?: string;
  isLoading: boolean;
  hasError: boolean;
  onDecrypt: () => void;
}

export const EncryptedMediaPlaceholder = ({
  label,
  errorLabel,
  minHeight = '200px',
  isLoading,
  hasError,
  onDecrypt,
}: EncryptedMediaPlaceholderProps) => {
  if (hasError) {
    return (
      <Box
        $align="center"
        $justify="center"
        $color="var(--c--contextuals--content--semantic--neutral--secondary)"
        $background="var(--c--contextuals--background--surface--tertiary)"
        $border="1px solid var(--c--contextuals--border--surface--primary)"
        $minHeight={minHeight}
        $padding="base"
        $css={css`
          text-align: center;
        `}
        contentEditable={false}
      >
        {errorLabel}
      </Box>
    );
  }

  return (
    <Box
      $align="center"
      $justify="center"
      $color="var(--c--contextuals--content--semantic--neutral--secondary)"
      $background="var(--c--contextuals--background--surface--tertiary)"
      $border="1px solid var(--c--contextuals--border--surface--primary)"
      $minHeight={minHeight}
      $padding="base"
      $css={css`
        text-align: center;
        cursor: ${isLoading ? 'wait' : 'pointer'};
        position: relative;
      `}
      contentEditable={false}
      onClick={() => !isLoading && onDecrypt()}
    >
      <Icon iconName="lock" $size="h3" />
      <Box $margin={{ top: '4xs' }}>{label}</Box>
      {isLoading && (
        <Box
          $align="center"
          $justify="center"
          $css={css`
            position: absolute;
            inset: 0;
            background: color-mix(
              in srgb,
              var(--c--contextuals--background--surface--tertiary) 80%,
              transparent
            );
          `}
        >
          <Loading />
        </Box>
      )}
    </Box>
  );
};
