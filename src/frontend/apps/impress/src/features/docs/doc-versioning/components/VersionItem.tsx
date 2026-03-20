import { useTranslation } from 'react-i18next';

import { BoxButton, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

interface VersionItemProps {
  text: string;
  isActive: boolean;
  onSelect?: () => void;
}

export const VersionItem = ({ text, isActive, onSelect }: VersionItemProps) => {
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
      <Text $weight="bold" $size="sm" $textAlign="left">
        {text}
      </Text>
    </BoxButton>
  );
};
