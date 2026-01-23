import { ComponentPropsWithRef, ElementType } from 'react';
import styled, { CSSProperties, RuleSet } from 'styled-components';

import {
  MarginPadding,
  Spacings,
  spacingValue,
  stylesMargin,
  stylesPadding,
} from '@/utils/styleBuilder';

import { hideEffect, showEffect } from './Effect';

export interface BoxProps {
  as?: ElementType;
  $align?: CSSProperties['alignItems'];
  $background?: CSSProperties['background'];
  $border?: CSSProperties['border'];
  $color?: CSSProperties['color'];
  $css?: string | RuleSet<object>;
  $cursor?: CSSProperties['cursor'];
  $direction?: CSSProperties['flexDirection'];
  $display?: CSSProperties['display'];
  $effect?: 'show' | 'hide';
  $flex?: CSSProperties['flex'];
  $gap?: Spacings;
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
  $zIndex?: CSSProperties['zIndex'];
  $wrap?: CSSProperties['flexWrap'];
  // Theming props
  $layer?: 'background' | 'content' | 'border';
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
  $scope?: 'surface' | 'semantic' | 'palette' | (string & {});
  $variation?: 'primary' | 'secondary' | 'tertiary' | (string & {});
  $withThemeBG?: boolean;
  $withThemeBorder?: boolean;
  $withThemeInherited?: boolean;
}

export type BoxType = ComponentPropsWithRef<typeof Box>;

export const Box = styled('div')<BoxProps>`
  ${({ $align }) => $align && `align-items: ${$align};`}
  ${({ $cursor }) => $cursor && `cursor: ${$cursor};`}
  ${({ $direction }) => `flex-direction: ${$direction || 'column'};`}
  ${({ $display, as }) =>
    `display: ${$display || (typeof as === 'string' && as.match('span|input') ? 'inline-flex' : 'flex')};`}
  ${({ $flex }) => $flex && `flex: ${$flex};`}
  ${({ $gap }) => $gap && `gap: ${spacingValue($gap)};`}
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
    $layer = 'border',
    $theme = 'brand',
    $variation = 'primary',
    $scope = 'semantic',
    $border,
    $withThemeBorder,
    $withThemeInherited,
  }) => {
    if ($border) {
      return `border: ${$border};`;
    }

    if (!$layer || !$scope || !$theme || !$withThemeBorder) {
      return '';
    }

    if ($withThemeInherited) {
      return `border: inherit;`;
    }

    return `border: 1px solid var(--c--contextuals--${$layer}--${$scope}${$theme ? `--${$theme}` : ''}${$variation ? `--${$variation}` : ''});`;
  }}
  ${({
    $layer = 'background',
    $theme = 'brand',
    $variation = 'primary',
    $scope = 'semantic',
    $background,
    $withThemeBG,
    $withThemeInherited,
  }) => {
    if ($background) {
      return `background: ${$background};`;
    }

    if (!$layer || !$scope || !$theme || !$withThemeBG) {
      return '';
    }

    if ($withThemeInherited) {
      return `background: inherit;`;
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
    $withThemeInherited,
  }) => {
    if ($color) {
      return `color: ${$color};`;
    }

    if (!$layer || !$scope) {
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

    if ($withThemeInherited) {
      return `color: inherit;`;
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
        transition: all var(--c--globals--transitions--duration) var(--c--globals--transitions--ease-out);
        ${effect}
      `
    );
  }}
`;
