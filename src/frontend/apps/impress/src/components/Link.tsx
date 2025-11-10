import Link from 'next/link';
import styled, { RuleSet } from 'styled-components';

export interface LinkProps {
  $css?: string | RuleSet<object>;
}

export const StyledLink = styled(Link)<LinkProps>`
  text-decoration: none;
  color: #ffffff33;
  &[aria-current='page'] {
    color: #ffffff;
  }
  display: flex;
  ${({ $css }) => $css && (typeof $css === 'string' ? `${$css};` : $css)}
`;
