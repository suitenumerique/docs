import { css, keyframes } from 'styled-components';

import { Box, BoxType } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useResponsiveStore } from '@/stores';

import { SkeletonCircle, SkeletonLine } from './SkeletionUI';

export const DocEditorSkeleton = () => {
  return (
    <>
      {/* Main Editor Container */}
      <Box
        $maxWidth="868px"
        $width="100%"
        $height="100%"
        className="--docs--doc-editor-skeleton"
      >
        <SkeletonEditorHeader />
        <SkeletonEditorCore />
      </Box>
    </>
  );
};

const SkeletonEditorHeader = () => {
  const { isDesktop } = useResponsiveStore();
  const { spacingsTokens } = useCunninghamTheme();

  return (
    <Box
      $padding={{ horizontal: isDesktop ? '54px' : 'base' }}
      className="--docs--doc-editor-header-skeleton"
    >
      <Box
        $width="100%"
        $padding={{ top: isDesktop ? '65px' : 'md' }}
        $gap={spacingsTokens['base']}
      >
        <Box
          $direction="row"
          $align="center"
          $width="100%"
          $padding={{ bottom: 'xs' }}
        >
          <Box
            $direction="row"
            $justify="space-between"
            $css="flex:1;"
            $gap="0.5rem 1rem"
            $align="center"
            $maxWidth="100%"
          >
            {/* Title and metadata skeleton */}
            <Box $gap="0.25rem" $css="flex:1;">
              {/* Title - "Untitled Document" style */}
              <SkeletonLine $width="35%" $height="40px" />

              {/* Metadata (role and last update) */}
              <Box $direction="row" $gap="0.5rem" $align="center">
                <SkeletonLine $maxWidth="260px" $height="12px" />
              </Box>
            </Box>

            {/* Toolbox skeleton (buttons) */}
            <Box $direction="row" $gap={spacingsTokens['t']} $align="center">
              {/* Share button */}
              <SkeletonLine $width="90px" $height="40px" />
              {/* Download icon */}
              <SkeletonCircle $width="40px" $height="40px" />
              {/* Menu icon */}
              <SkeletonCircle $width="40px" $height="40px" />
            </Box>
          </Box>
        </Box>

        {/* Separator */}
        <SkeletonLine $height="1px" />
      </Box>
    </Box>
  );
};

export const SKELETON_FADE_DURATION_MS = 150;
const skeletonFadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

type SkeletonEditorCoreProps = Partial<BoxType> & {
  isFadingOut?: boolean;
};

export const SkeletonEditorCore = ({
  isFadingOut,
  $css,
  ...props
}: SkeletonEditorCoreProps) => {
  const { isDesktop } = useResponsiveStore();

  return (
    <Box
      $direction="row"
      $width="100%"
      $css="overflow-x: clip; flex: 1;"
      $position="relative"
      className="--docs--doc-editor-content-skeleton"
    >
      <Box
        $position="relative"
        $width="100%"
        $padding={{ horizontal: isDesktop ? '54px' : 'base', top: 'md' }}
        $flex="1"
        $css={css`
          ${$css}
          ${isFadingOut &&
          css`
            animation: ${skeletonFadeOut} ${SKELETON_FADE_DURATION_MS}ms
              ease-in-out forwards;
          `}
        `}
        {...props}
      >
        <Box $gap="1.5rem">
          <SkeletonLine $width="65%" $height="35px" />
          <SkeletonLine $width="55%" $height="25px" />
          <SkeletonLine $width="35%" $height="20px" />
        </Box>
      </Box>
    </Box>
  );
};
