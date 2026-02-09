import { useMemo } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham/useCunninghamTheme';
import { LeftPanelCollapseButton } from '@/features/left-panel';
import { useResponsiveStore } from '@/stores';

/**
 * Sticky bar trick (desktop):
 * - MainContent has padding `base`; we extend the bar width and apply
 *   matching negative margins so it aligns with the scroll area edges.
 *
 * Mobile: returns null to avoid header overlap.
 */
export const FloatingBar = () => {
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();

  const FLOATING_STYLES = useMemo(() => {
    const base = spacingsTokens['base'];
    const sm = spacingsTokens['sm'];
    return css`
      position: sticky;
      top: calc(-${base});
      left: 0;
      right: 0;
      width: calc(100% + ${base} + ${base});
      min-height: 64px;
      padding: ${sm};
      margin-left: calc(-${base});
      margin-right: calc(-${base});
      margin-top: calc(-${base});
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      isolation: isolate;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: linear-gradient(
          180deg,
          #fff 0%,
          rgba(255, 255, 255, 0) 100%
        );
        backdrop-filter: blur(1px);
        -webkit-backdrop-filter: blur(1px);
        mask-image: linear-gradient(180deg, black 50%, transparent 100%);
        -webkit-mask-image: linear-gradient(
          180deg,
          black 50%,
          transparent 100%
        );
      }

      > * {
        position: relative;
        z-index: 1;
      }
    `;
  }, [spacingsTokens]);

  if (!isDesktop) {
    return null;
  }

  return (
    <Box
      className="--docs--floating-bar"
      data-testid="floating-bar"
      $css={FLOATING_STYLES}
    >
      <LeftPanelCollapseButton />
    </Box>
  );
};
