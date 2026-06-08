import { css } from 'styled-components';

import { Box, Card } from '@/components';
import { useDocStore } from '@/docs/doc-management/stores/useDocStore';
import { DocShareButton } from '@/features/docs/doc-share/components/DocShareButton';
import { LeftPanelCollapseButton } from '@/features/left-panel/components/LeftPanelCollapseButton';
import { RightPanelCollapseButton } from '@/features/right-panel/components/RightPanelCollapseButton';
import { useResponsiveStore } from '@/stores';

import { DocToolBox } from './DocToolBox';

const FLOATING_STYLES = css`
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  padding: var(--c--globals--spacings--sm);
  padding-bottom: 0;
  z-index: 10; // Under editor select box but above other elements (e.g., doc title, suggestion menu)
  align-items: flex-start;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(180deg, #fff 0%, rgba(255, 255, 255, 0) 100%);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    mask-image: linear-gradient(180deg, black 50%, transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, black 50%, transparent 100%);
  }

  > * {
    position: relative;
    z-index: 1;
  }
`;

/**
 * Sticky bar trick (desktop):
 * - MainContent has padding `base`; we extend the bar width and apply
 *   matching negative margins so it aligns with the scroll area edges.
 *
 * Mobile: returns null to avoid header overlap.
 */
export const FloatingBar = () => {
  const { isLargeScreen } = useResponsiveStore();
  const { currentDoc } = useDocStore();
  const isDeletedDoc = !!currentDoc?.deleted_at;

  return (
    <Box
      className="--docs--floating-bar"
      data-testid="floating-bar"
      $css={FLOATING_STYLES}
      $direction="row"
      $justify="space-between"
    >
      {isLargeScreen ? <LeftPanelCollapseButton /> : <Box />}
      <Box $direction="row" $align="center" $gap="2xs">
        {!isDeletedDoc && currentDoc && <DocShareButton doc={currentDoc} />}
        <Card
          className="--docs--right-panel-collapse-button"
          $direction="row"
          $css={css`
            padding: var(--c--globals--spacings--xxxs);
            align-items: center;
            gap: var(--c--globals--spacings--xxxs);
            border-radius: var(--c--globals--spacings--xs);
            box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);
          `}
        >
          <RightPanelCollapseButton />
          {!isDeletedDoc && currentDoc && <DocToolBox doc={currentDoc} />}
        </Card>
      </Box>
    </Box>
  );
};
