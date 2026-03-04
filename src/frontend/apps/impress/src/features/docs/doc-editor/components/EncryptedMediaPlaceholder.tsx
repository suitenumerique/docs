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
        $color="#666"
        $background="#f5f5f5"
        $border="1px solid #ddd"
        $minHeight={minHeight}
        $padding="20px"
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
      $color="#666"
      $background="#f5f5f5"
      $border="1px solid #ddd"
      $minHeight={minHeight}
      $padding="20px"
      $css={css`
        text-align: center;
        cursor: ${isLoading ? 'wait' : 'pointer'};
        position: relative;
      `}
      contentEditable={false}
      onClick={() => !isLoading && onDecrypt()}
    >
      <Icon iconName="lock" $size="24px" />
      <Box $margin={{ top: '2px' }}>{label}</Box>
      {isLoading && (
        <Box
          $align="center"
          $justify="center"
          $css={css`
            position: absolute;
            inset: 0;
            background: rgba(245, 245, 245, 0.8);
          `}
        >
          <Loading />
        </Box>
      )}
    </Box>
  );
};
