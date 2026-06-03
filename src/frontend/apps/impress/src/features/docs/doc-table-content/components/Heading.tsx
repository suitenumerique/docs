import { useState } from 'react';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { DocsBlockNoteEditor } from '@/docs/doc-editor/types';
import { useResponsiveStore } from '@/stores';

const leftPaddingMap: { [key: number]: string } = {
  3: '1.5rem',
  2: '0.9rem',
  1: 'xs',
};

export type HeadingsHighlight = {
  headingId: string;
  isVisible: boolean;
}[];

interface HeadingProps {
  editor: DocsBlockNoteEditor;
  level: number;
  text: string;
  headingId: string;
  isHighlight: boolean;
}

export const Heading = ({
  headingId,
  editor,
  isHighlight,
  level,
  text,
}: HeadingProps) => {
  const [isHover, setIsHover] = useState(isHighlight);
  const { colorsTokens } = useCunninghamTheme();
  const { isMobile } = useResponsiveStore();
  const isActive = isHighlight || isHover;

  return (
    <Box
      as="a"
      href={`#heading-${headingId}`}
      className="--docs--table-content-heading"
      $width="100%"
      $minHeight="var(--c--globals--spacings--lg)"
      onMouseOver={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        // With mobile the focus open the keyboard and the scroll is not working
        e.preventDefault();

        if (!isMobile) {
          editor.focus();
        }

        editor.setTextCursorPosition(headingId, 'end');

        document
          .querySelector<HTMLElement>(`[data-id="${headingId}"]`)
          ?.scrollIntoView({
            behavior: 'smooth',
            inline: 'start',
            block: 'start',
          });
      }}
      $radius="var(--c--globals--spacings--st)"
      $background={
        isActive
          ? 'var(--c--contextuals--background--semantic--overlay--primary)'
          : 'none'
      }
      $justify="center"
      $padding="none"
      $margin="none"
      $hasTransition
      $css={css`
        text-align: left;
        display: flex;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        &:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px ${colorsTokens['brand-400']};
          border-radius: var(--c--globals--spacings--st);
        }
      `}
      aria-label={text}
      aria-current={isHighlight ? 'true' : undefined}
    >
      <Text
        $size="sm"
        $padding={{ left: leftPaddingMap[level], vertical: 'xs' }}
        $weight={isHighlight ? '700' : '500'}
        $css="overflow-wrap: break-word;"
        $hasTransition
      >
        {text}
      </Text>
    </Box>
  );
};
