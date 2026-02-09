import { RuleSet, css } from 'styled-components';

import { Box } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useResponsiveStore } from '@/stores';

import { FloatingBarLeft } from './FloatingBarLeft';

export const FLOATING_BAR_HEIGHT = '64px';
export const FLOATING_BAR_Z_INDEX = 1000;
const FLOATING_BAR_BLUR_RADIUS = '1px';
const FLOATING_BAR_GRADIENT =
  'linear-gradient(180deg, #FFF 0%, rgba(255, 255, 255, 0) 100%)';

/**
 * Sticky bar trick (desktop):
 * - MainContent has padding `base`; we extend the bar width and apply
 *   matching negative margins (mainContentPadding) so it aligns with the
 *   scroll area edges.
 * - `top: calc(-mainContentPadding)` keeps sticky positioning visually
 *   aligned with the content start.
 *
 * Mobile: returns null to avoid header overlap.
 */
const getFloatingBarStyles = (
  mainContentPadding: string,
  barSpacing: string,
  blurRadius: string,
): RuleSet => css`
  position: sticky;
  top: calc(-${mainContentPadding});
  left: 0;
  right: 0;
  width: calc(100% + ${mainContentPadding} + ${mainContentPadding});
  min-height: ${FLOATING_BAR_HEIGHT};
  padding: ${barSpacing};
  margin-left: calc(-${mainContentPadding});
  margin-right: calc(-${mainContentPadding});
  margin-top: calc(-${mainContentPadding});
  z-index: ${FLOATING_BAR_Z_INDEX};
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  background: ${FLOATING_BAR_GRADIENT};
  backdrop-filter: blur(${blurRadius});
  -webkit-backdrop-filter: blur(${blurRadius});

  > * {
    position: relative;
    z-index: 1;
  }
`;

export const FloatingBar = () => {
  const { spacingsTokens } = useCunninghamTheme();
  const { isDesktop } = useResponsiveStore();
  const mainContentPadding =
    spacingsTokens['base'] || 'var(--c--globals--spacings--base)';
  const barSpacing = spacingsTokens['sm'] || 'var(--c--globals--spacings--sm)';

  if (!isDesktop) {
    return null;
  }

  return (
    <Box
      data-testid="floating-bar"
      $css={getFloatingBarStyles(
        mainContentPadding,
        barSpacing,
        FLOATING_BAR_BLUR_RADIUS,
      )}
    >
      <FloatingBarLeft />
    </Box>
  );
};
