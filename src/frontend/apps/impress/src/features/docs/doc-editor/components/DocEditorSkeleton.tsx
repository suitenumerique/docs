import { css, keyframes } from 'styled-components';

import { Box } from '@/components';
import { tokens, useCunninghamTheme } from '@/cunningham';
import { useResponsiveStore } from '@/stores';

const colors = tokens.themes.default.theme.colors;

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

const SkeletonLine = ({
  width = '100%',
  height = '16px',
  margin = '0',
}: {
  width?: string;
  height?: string;
  margin?: string;
}) => {
  return (
    <Box
      $css={css`
        width: ${width};
        height: ${height};
        margin: ${margin};
        background: linear-gradient(
          90deg,
          ${colors['greyscale-100']} 0%,
          ${colors['greyscale-200']} 50%,
          ${colors['greyscale-100']} 100%
        );
        background-size: 1000px 100%;
        animation: ${shimmer} 2s infinite linear;
        border-radius: 4px;
      `}
    />
  );
};

const SkeletonCircle = ({ size = '32px' }: { size?: string }) => {
  return (
    <Box
      $css={css`
        width: ${size};
        height: ${size};
        background: linear-gradient(
          90deg,
          ${colors['greyscale-100']} 0%,
          ${colors['greyscale-200']} 50%,
          ${colors['greyscale-100']} 100%
        );
        background-size: 1000px 100%;
        animation: ${shimmer} 2s infinite linear;
        border-radius: 50%;
      `}
    />
  );
};

export const DocEditorSkeleton = () => {
  const { isDesktop } = useResponsiveStore();
  const { spacingsTokens } = useCunninghamTheme();

  return (
    <>
      {/* Main Editor Container */}
      <Box
        $maxWidth="868px"
        $width="100%"
        $height="100%"
        className="--docs--doc-editor-skeleton"
      >
        {/* Header Skeleton */}
        <Box
          $padding={{ horizontal: isDesktop ? '54px' : 'base' }}
          className="--docs--doc-editor-header-skeleton"
        >
          <Box
            $width="100%"
            $padding={{ top: isDesktop ? '50px' : 'md' }}
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
                  {/* Title - "Document sans titre" style */}
                  <SkeletonLine width="35%" height="40px" />

                  {/* Metadata (role and last update) */}
                  <Box $direction="row" $gap="0.5rem" $align="center">
                    <SkeletonLine width="260px" height="12px" />
                  </Box>
                </Box>

                {/* Toolbox skeleton (buttons) */}
                <Box $direction="row" $gap="0.75rem" $align="center">
                  {/* Partager button */}
                  <SkeletonLine width="90px" height="40px" />
                  {/* Download icon */}
                  <SkeletonCircle size="40px" />
                  {/* Menu icon */}
                  <SkeletonCircle size="40px" />
                </Box>
              </Box>
            </Box>

            {/* Separator */}
            <SkeletonLine width="100%" height="1px" />
          </Box>
        </Box>

        {/* Content Skeleton */}
        <Box
          $direction="row"
          $width="100%"
          $css="overflow-x: clip; flex: 1;"
          $position="relative"
          className="--docs--doc-editor-content-skeleton"
        >
          <Box
            $css="flex:1;"
            $position="relative"
            $width="100%"
            $padding={{ horizontal: isDesktop ? '54px' : 'base', top: 'lg' }}
          >
            {/* Placeholder text similar to screenshot */}
            <Box $gap="0rem">
              {/* Single placeholder line like in the screenshot */}
              <SkeletonLine width="85%" height="20px" />
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};
