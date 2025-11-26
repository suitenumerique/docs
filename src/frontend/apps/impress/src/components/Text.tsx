import { CSSProperties, ComponentPropsWithRef, forwardRef } from 'react';
import styled from 'styled-components';

import { tokens } from '@/cunningham';

import { Box, BoxProps } from './Box';

const { sizes } = tokens.themes.default.globals.font;
type TextSizes = keyof typeof sizes;

export interface TextProps extends BoxProps {
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  $ellipsis?: boolean;
  $weight?: CSSProperties['fontWeight'];
  $textAlign?: CSSProperties['textAlign'];
  $textTransform?: CSSProperties['textTransform'];
  $size?: TextSizes | (string & {});
}

export type TextType = ComponentPropsWithRef<typeof Text>;

export const TextStyled = styled(Box)<TextProps>`
  ${({ $textAlign }) => $textAlign && `text-align: ${$textAlign};`}
  ${({ $textTransform }) =>
    $textTransform && `text-transform: ${$textTransform};`}
  ${({ $weight }) => $weight && `font-weight: ${$weight};`}
  ${({ $size }) =>
    $size &&
    `font-size: ${$size in sizes ? sizes[$size as TextSizes] : $size};`}
  ${({ $ellipsis }) =>
    $ellipsis &&
    `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`}
`;

const Text = forwardRef<HTMLElement, ComponentPropsWithRef<typeof TextStyled>>(
  (props, ref) => {
    return <TextStyled ref={ref} as="span" {...props} />;
  },
);

Text.displayName = 'Text';

export { Text };
