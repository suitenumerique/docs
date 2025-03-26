import { useState } from 'react';

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
      key={headingId}
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
      $radius="4px"
      $background={isActive ? `${colorsTokens()['greyscale-100']}` : 'none'}
      $css="text-align: left;"
      className="--docs--table-content-heading"
    >
      <Text
        $width="100%"
        $padding={{ vertical: 'xtiny', left: leftPaddingMap[level] }}
        $variation={isActive ? '1000' : '700'}
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
