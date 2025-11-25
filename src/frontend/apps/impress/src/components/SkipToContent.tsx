import { Button } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MAIN_LAYOUT_ID } from '@/layouts/conf';

export const SkipToContent = () => {
  const { t } = useTranslation();
  const router = useRouter();
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
    <Button
      href={`#${MAIN_LAYOUT_ID}`}
      onClick={handleClick}
      color="tertiary"
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      style={{
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 0.3s ease-in-out',
        position: 'fixed',
        top: 'var(--c--theme--spacings--2xs)',
        // padding header + logo(32px) + gap(3xs≈4px) + text "Docs"(≈70px) + 12px
        left: 'calc(var(--c--theme--spacings--base) + 32px + var(--c--theme--spacings--3xs) + 70px + 12px)',
        zIndex: 9999,
        whiteSpace: 'nowrap',
      }}
    >
      {t('Go to content')}
    </Button>
  );
};
