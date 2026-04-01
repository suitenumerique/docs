import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

interface VersionItemProps {
  text: string;
  isActive: boolean;
  onSelect?: () => void;
  selectionLabel?: string;
}

export const VersionItem = ({
  text,
  isActive,
  onSelect,
  selectionLabel,
}: VersionItemProps) => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();

  return (
    <BoxButton
      aria-label={t('Restore version of {{date}}', { date: text })}
      aria-pressed={isActive}
      $width="100%"
      $css={`
        background: ${isActive ? 'var(--c--contextuals--background--semantic--overlay--primary)' : 'transparent'};
        &:focus-visible, &:hover {
          background: var(--c--contextuals--background--semantic--overlay--primary);
        }
      `}
      className="version-item --docs--version-item"
      onClick={onSelect}
      $radius={spacingsTokens['3xs']}
      $padding={{ vertical: 'm', horizontal: 'xs' }}
      $hasTransition
    >
      <Box $direction="row" $align="center" $gap="xs" $width="100%">
        <Text $weight="bold" $size="sm" $textAlign="left" $css="flex: 1;">
          {text}
        </Text>
        {selectionLabel && (
          <Text
            $weight="bold"
            $size="xs"
            $css={`
              background: var(--c--contextuals--background--semantic--overlay--primary);
              border-radius: 4px;
              padding: 0 6px;
              min-width: 20px;
              text-align: center;
            `}
          >
            {selectionLabel}
          </Text>
        )}
      </Box>
    </BoxButton>
  );
};
