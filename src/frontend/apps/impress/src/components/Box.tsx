import { ComponentPropsWithRef, HTMLElementType } from 'react';
import styled from 'styled-components';
import { CSSProperties, RuleSet } from 'styled-components/dist/types';

import {
  MarginPadding,
  stylesMargin,
  stylesPadding,
} from '@/utils/styleBuilder';

import { hideEffect, showEffect } from './Effect';

export interface BoxProps {
  as?: HTMLElementType;
  $align?: CSSProperties['alignItems'];
  $background?: CSSProperties['background'];
  $color?: CSSProperties['color'];
  $css?: string | RuleSet<object>;
  $direction?: CSSProperties['flexDirection'];
  $display?: CSSProperties['display'];
  $effect?: 'show' | 'hide';
  $flex?: CSSProperties['flex'];
  $gap?: CSSProperties['gap'];
  $hasTransition?: boolean | 'slow';
  $height?: CSSProperties['height'];
  $justify?: CSSProperties['justifyContent'];
  $opacity?: CSSProperties['opacity'];
  $overflow?: CSSProperties['overflow'];
  $margin?: MarginPadding;
  $maxHeight?: CSSProperties['maxHeight'];
  $minHeight?: CSSProperties['minHeight'];
  $maxWidth?: CSSProperties['maxWidth'];
  $minWidth?: CSSProperties['minWidth'];
  $padding?: MarginPadding;
  $position?: CSSProperties['position'];
  $radius?: CSSProperties['borderRadius'];
  $shrink?: CSSProperties['flexShrink'];
  $transition?: CSSProperties['transition'];
  $width?: CSSProperties['width'];
  $wrap?: CSSProperties['flexWrap'];
  $zIndex?: CSSProperties['zIndex'];
}

export type BoxType = ComponentPropsWithRef<typeof Box>;

export const Box = styled('div')<BoxProps>`
  display: flex;
  flex-direction: column;
  ${({ $align }) => $align && `align-items: ${$align};`}
  ${({ $background }) => $background && `background: ${$background};`}
  ${({ $color }) => $color && `color: ${$color};`}
  ${({ $direction }) => $direction && `flex-direction: ${$direction};`}
  ${({ $display }) => $display && `display: ${$display};`}
  ${({ $flex }) => $flex && `flex: ${$flex};`}
  ${({ $gap }) => $gap && `gap: ${$gap};`}
  ${({ $height }) => $height && `height: ${$height};`}
  ${({ $hasTransition }) =>
    $hasTransition && $hasTransition === 'slow'
      ? `transition: all 0.5s ease-in-out;`
      : $hasTransition
        ? `transition: all 0.3s ease-in-out;`
        : ''}
  ${({ $justify }) => $justify && `justify-content: ${$justify};`}
  ${({ $margin }) => $margin && stylesMargin($margin)}
  ${({ $maxHeight }) => $maxHeight && `max-height: ${$maxHeight};`}
  ${({ $minHeight }) => $minHeight && `min-height: ${$minHeight};`}
  ${({ $maxWidth }) => $maxWidth && `max-width: ${$maxWidth};`}
  ${({ $minWidth }) => $minWidth && `min-width: ${$minWidth};`}
  ${({ $opacity }) => $opacity && `opacity: ${$opacity};`}
  ${({ $overflow }) => $overflow && `overflow: ${$overflow};`}
  ${({ $padding }) => $padding && stylesPadding($padding)}
  ${({ $position }) => $position && `position: ${$position};`}
  ${({ $radius }) => $radius && `border-radius: ${$radius};`}
  ${({ $shrink }) => $shrink && `flex-shrink: ${$shrink};`}
  ${({ $transition }) => $transition && `transition: ${$transition};`}
  ${({ $width }) => $width && `width: ${$width};`}
  ${({ $wrap }) => $wrap && `flex-wrap: ${$wrap};`}
  ${({ $css }) => $css && (typeof $css === 'string' ? `${$css};` : $css)}
  ${({ $zIndex }) => $zIndex && `z-index: ${$zIndex};`}
  ${({ $effect }) => {
    let effect;
    switch ($effect) {
      case 'show':
        effect = showEffect;
        break;
      case 'hide':
        effect = hideEffect;
        break;
    }

    return (
      effect &&
      ` 
        transition: all 0.3s ease-in-out;
        ${effect}
      `
    );
  }}
`;
