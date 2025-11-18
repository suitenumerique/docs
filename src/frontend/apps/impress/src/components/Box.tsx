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
  $cursor?: CSSProperties['cursor'];
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
  $layer?: 'background' | 'content' | 'border';
  $scope?: 'surface' | 'semantic' | 'palette' | (string & {});
  $theme?:
    | 'brand'
    | 'error'
    | 'gray'
    | 'info'
    | 'success'
    | 'warning'
    | 'neutral'
    | 'contextual'
    | 'disabled'
    | (string & {});
  $transition?: CSSProperties['transition'];
  $variation?: 'primary' | 'secondary' | 'tertiary' | (string & {});
  $width?: CSSProperties['width'];
  $wrap?: CSSProperties['flexWrap'];
  $withThemeBG?: boolean;
  $zIndex?: CSSProperties['zIndex'];
}

export type BoxType = ComponentPropsWithRef<typeof Box>;

export const Box = styled('div')<BoxProps>`
  ${({ $align }) => $align && `align-items: ${$align};`}
  ${({ $cursor }) => $cursor && `cursor: ${$cursor};`}
  ${({ $direction }) => `flex-direction: ${$direction || 'column'};`}
  ${({ $display, as }) =>
    `display: ${$display || (as?.match('span|input') ? 'inline-flex' : 'flex')};`}
  ${({ $flex }) => $flex && `flex: ${$flex};`}
  ${({ $gap }) => $gap && `gap: ${$gap};`}
  ${({ $height }) => $height && `height: ${$height};`}
  ${({ $hasTransition }) =>
    $hasTransition && $hasTransition === 'slow'
      ? `transition: all 0.5s var(--c--globals--transitions--ease-out);`
      : $hasTransition
        ? `transition: all var(--c--globals--transitions--duration) var(--c--globals--transitions--ease-out);`
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
  ${({
    $layer = 'background',
    $theme = 'brand',
    $variation = 'primary',
    $scope = 'semantic',
    $background,
    $withThemeBG,
  }) => {
    if ($background) {
      return `background: ${$background};`;
    }

    if (!$layer || !$scope || !$theme || !$withThemeBG) {
      return '';
    }

    return `background: var(--c--contextuals--${$layer}--${$scope}${$theme ? `--${$theme}` : ''}${$variation ? `--${$variation}` : ''});`;
  }}
  ${({
    $layer = 'content',
    $theme = 'neutral',
    $variation = 'primary',
    $scope = 'semantic',
    $color,
    $withThemeBG,
  }) => {
    if ($color) {
      return `color: ${$color};`;
    }

    if (!$layer || !$scope || !$theme) {
      return '';
    }

    // There is a special case when primary with background
    if (
      $withThemeBG &&
      $layer === 'content' &&
      $scope === 'semantic' &&
      $variation === 'primary' &&
      $theme
    ) {
      $variation = `on-${$theme}`;
    }

    return `color: var(--c--contextuals--${$layer}--${$scope}${$theme ? `--${$theme}` : ''}${$variation ? `--${$variation}` : ''});`;
  }}
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
