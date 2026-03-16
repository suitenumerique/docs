import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { focusMainContentStart } from '@/layouts/utils';

export const SkipToContent = () => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const [isVisible, setIsVisible] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const focusTarget = focusMainContentStart();

    if (focusTarget instanceof HTMLElement) {
      focusTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <Box>
      <Button
        href={`#${MAIN_LAYOUT_ID}`}
        color="brand"
        className="--docs--skip-to-content"
        onClick={handleClick}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        style={{
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          position: 'fixed',
          top: spacingsTokens['2xs'],
          left: `calc(${spacingsTokens['base']} + 32px + ${spacingsTokens['3xs']} + 70px + 12px)`,
          zIndex: 9999,
          whiteSpace: 'nowrap',
        }}
      >
        {t('Go to content')}
      </Button>
    </Box>
  );
};
