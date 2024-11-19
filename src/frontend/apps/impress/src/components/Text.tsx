import {
  CSSProperties,
  ComponentPropsWithRef,
  ReactHTML,
  forwardRef,
} from 'react';
import styled from 'styled-components';

import { tokens } from '@/cunningham';

import { Box, BoxProps } from './Box';

const { sizes } = tokens.themes.default.theme.font;
type TextSizes = keyof typeof sizes;

export interface TextProps extends BoxProps {
  as?: keyof Pick<
    ReactHTML,
    'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  >;
  $elipsis?: boolean;
  $isMaterialIcon?: boolean;
  $weight?: CSSProperties['fontWeight'];
  $textAlign?: CSSProperties['textAlign'];
  $size?: TextSizes | (string & {});
  $theme?:
    | 'primary'
    | 'secondary'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'greyscale';
  $variation?:
    | 'text'
    | '000'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900'
    | '1000';
}

export type TextType = ComponentPropsWithRef<typeof Text>;

export const TextStyled = styled(Box)<TextProps>`
  ${({ $textAlign }) => $textAlign && `text-align: ${$textAlign};`}
  ${({ $weight }) => $weight && `font-weight: ${$weight};`}
  ${({ $size }) =>
    $size &&
    `font-size: ${$size in sizes ? sizes[$size as TextSizes] : $size};`}
  ${({ $theme, $variation }) =>
    `color: var(--c--theme--colors--${$theme}-${$variation});`}
  ${({ $color }) => $color && `color: ${$color};`}
  ${({ $elipsis }) =>
    $elipsis &&
    `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`}
`;

const Text = forwardRef<HTMLElement, ComponentPropsWithRef<typeof TextStyled>>(
  ({ className, $isMaterialIcon, ...props }, ref) => {
    return (
      <TextStyled
        ref={ref}
        as="span"
        $theme="greyscale"
        $variation="text"
        className={`${className || ''}${$isMaterialIcon ? ' material-icons' : ''}`}
        {...props}
      />
    );
  },
);

Text.displayName = 'Text';

export { Text };
