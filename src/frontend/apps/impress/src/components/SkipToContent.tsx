import { Button } from '@gouvfr-lasuite/cunningham-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';

export const SkipToContent = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { spacingsTokens } = useCunninghamTheme();
  const [isVisible, setIsVisible] = useState(false);

  // Reset focus after route change so first TAB goes to skip link
  useEffect(() => {
    const handleRouteChange = () => {
      (document.activeElement as HTMLElement)?.blur();

      document.body.setAttribute('tabindex', '-1');
      document.body.focus({ preventScroll: true });

      setTimeout(() => {
        document.body.removeAttribute('tabindex');
      }, 100);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const mainContent = document.getElementById(MAIN_LAYOUT_ID);
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <Box
      $css={css`
        .c__button--brand--primary.--docs--skip-to-content:focus-visible {
          box-shadow:
            0 0 0 1px var(--c--globals--colors--white-000),
            0 0 0 4px var(--c--contextuals--border--semantic--brand--primary);
          border-radius: var(--c--globals--spacings--st);
        }
      `}
    >
      <Button
        onClick={handleClick}
        type="button"
        color="brand"
        className="--docs--skip-to-content"
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        style={{
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          position: 'fixed',
          top: spacingsTokens['2xs'],
          // padding header + logo(32px) + gap(3xs≈4px) + text "Docs"(≈70px) + 12px
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
