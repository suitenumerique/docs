import { Button } from '@gouvfr-lasuite/cunningham-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ComponentProps } from 'react';
import styled, { type RuleSet } from 'styled-components';

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

type ButtonLinkProps = ComponentProps<typeof Button> & {
  href: string;
};

export const ButtonLink = ({
  children,
  onClick,
  ref,
  ...props
}: ButtonLinkProps) => {
  const router = useRouter();

  return (
    <Button
      ref={ref}
      onClick={(e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();

          if (props.href) {
            void router.push(props.href);
          }
        }
        onClick?.(e as React.MouseEvent<HTMLButtonElement, MouseEvent>);
      }}
      {...props}
    >
      {children}
    </Button>
  );
};
