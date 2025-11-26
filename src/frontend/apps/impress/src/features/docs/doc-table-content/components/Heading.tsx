import { useState } from 'react';
import { css } from 'styled-components';

import { BoxButton, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { DocsBlockNoteEditor } from '@/docs/doc-editor';
import { useResponsiveStore } from '@/stores';

const leftPaddingMap: { [key: number]: string } = {
  3: '1.5rem',
  2: '0.9rem',
  1: '0.3rem',
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
    <BoxButton
      id={`heading-${headingId}`}
      $width="100%"
      onMouseOver={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onClick={() => {
        // With mobile the focus open the keyboard and the scroll is not working
        if (!isMobile) {
          editor.focus();
        }

        editor.setTextCursorPosition(headingId, 'end');

        document.querySelector(`[data-id="${headingId}"]`)?.scrollIntoView({
          behavior: 'smooth',
          inline: 'start',
          block: 'start',
        });
      }}
      $radius="var(--c--globals--spacings--st)"
      $background={isActive ? `${colorsTokens['gray-100']}` : 'none'}
      $css={css`
        text-align: left;
        &:focus-visible {
          /* Scoped focus style: same footprint as hover, with theme shadow */
          outline: none;
          box-shadow: 0 0 0 2px ${colorsTokens['brand-400']};
          border-radius: var(--c--globals--spacings--st);
        }
      `}
      className="--docs--table-content-heading"
      aria-label={text}
      aria-selected={isHighlight}
      aria-current={isHighlight ? 'true' : undefined}
    >
      <Text
        $width="100%"
        $padding={{ vertical: 'xtiny', left: leftPaddingMap[level] }}
        $weight={isHighlight ? 'bold' : 'normal'}
        $css="overflow-wrap: break-word;"
        $hasTransition
        aria-selected={isHighlight}
      >
        {text}
      </Text>
    </BoxButton>
  );
};
