import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import { useCunninghamTheme } from '@/cunningham';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';

import { Box } from './Box';

const SkipLink = styled(Box)<{
  $colorsTokens: Record<string, string>;
  $spacingsTokens: Record<string, string>;
}>`
  ${({ $colorsTokens, $spacingsTokens }) => css`
    position: fixed;
    top: 0.5rem;
    /* Position: padding header + logo(32px) + gap(3xs≈4px) + text "Docs"(≈70px) + 12px */
    left: calc(
      ${$spacingsTokens['base']} + 32px + ${$spacingsTokens['3xs']} + 70px +
        12px
    );
    z-index: 9999;

    /* Figma specs - Layout */
    display: inline-flex;
    padding: ${$spacingsTokens['xs']} ${$spacingsTokens['xs']};
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: ${$spacingsTokens['4xs']};

    /* Figma specs - Style */
    border-radius: ${$spacingsTokens['3xs']};
    border: 1px solid
      var(--c--theme--colors--primary-300, ${$colorsTokens['primary-300']});
    background: var(
      --c--theme--colors--primary-100,
      ${$colorsTokens['primary-100']}
    );
    box-shadow: 0 6px 18px 0 rgba(0, 0, 145, 0.05);

    /* Figma specs - Typography */
    color: ${$colorsTokens['primary-600']};
    font-family: var(--c--theme--font--families--base, 'Marianne Variable');
    font-size: 14px;
    font-style: normal;
    font-weight: 500;
    line-height: 18px;

    /* Skip link appearance - Fade in/out */
    text-decoration: none;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease-in-out;

    &:focus,
    &:focus-visible {
      opacity: 1;
      pointer-events: auto;
      outline: 2px solid var(--c--theme--colors--primary-400);
      outline-offset: ${$spacingsTokens['4xs']};
    }

    &:focus:not(:focus-visible) {
      outline: none;
    }

    &:hover {
      background: var(
        --c--theme--colors--primary-200,
        ${$colorsTokens['primary-200']}
      );
      color: ${$colorsTokens['primary-700']};
    }
  `}
`;

export const SkipToContent = () => {
  const { t } = useTranslation();
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  // Prevent SSR flash - only render client-side
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const mainContent = document.getElementById(MAIN_LAYOUT_ID);
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Don't render during SSR to prevent flash
  if (!isMounted) {
    return null;
  }

  return (
    <SkipLink
      as="a"
      href={`#${MAIN_LAYOUT_ID}`}
      onClick={handleClick}
      $colorsTokens={colorsTokens}
      $spacingsTokens={spacingsTokens}
    >
      {t('Go to content')}
    </SkipLink>
  );
};
