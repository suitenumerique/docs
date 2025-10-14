import { css, keyframes } from 'styled-components';

import { Box, BoxType } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useResponsiveStore } from '@/stores';

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

type SkeletonLineProps = Partial<BoxType>;

type SkeletonCircleProps = Partial<BoxType>;

export const DocEditorSkeleton = () => {
  const { isDesktop } = useResponsiveStore();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();

  const SkeletonLine = ({ $css, ...props }: SkeletonLineProps) => {
    return (
      <Box
        $width="100%"
        $height="16px"
        $css={css`
          background: linear-gradient(
            90deg,
            ${colorsTokens['greyscale-100']} 0%,
            ${colorsTokens['greyscale-200']} 50%,
            ${colorsTokens['greyscale-100']} 100%
          );
          background-size: 1000px 100%;
          animation: ${shimmer} 2s infinite linear;
          border-radius: 4px;
          ${$css}
        `}
        {...props}
      />
    );
  };

  const SkeletonCircle = ({ $css, ...props }: SkeletonCircleProps) => {
    return (
      <Box
        $width="32px"
        $height="32px"
        $css={css`
          background: linear-gradient(
            90deg,
            ${colorsTokens['greyscale-100']} 0%,
            ${colorsTokens['greyscale-200']} 50%,
            ${colorsTokens['greyscale-100']} 100%
          );
          background-size: 1000px 100%;
          animation: ${shimmer} 2s infinite linear;
          border-radius: 50%;
          ${$css}
        `}
        {...props}
      />
    );
  };

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
          $padding={{ horizontal: isDesktop ? '70px' : 'base' }}
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
                  {/* Title - "Document sans titre" style */}
                  <SkeletonLine $width="35%" $height="40px" />

                  {/* Metadata (role and last update) */}
                  <Box $direction="row" $gap="0.5rem" $align="center">
                    <SkeletonLine $maxWidth="260px" $height="12px" />
                  </Box>
                </Box>

                {/* Toolbox skeleton (buttons) */}
                <Box $direction="row" $gap="0.75rem" $align="center">
                  {/* Partager button */}
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
            $padding={{ horizontal: isDesktop ? '70px' : 'base', top: 'lg' }}
          >
            {/* Placeholder text similar to screenshot */}
            <Box $gap="0rem">
              {/* Single placeholder line like in the screenshot */}
              <SkeletonLine $width="85%" $height="20px" />
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};
