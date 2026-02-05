import {
  PropsWithChildren,
  ReactNode,
  RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button, Popover } from 'react-aria-components';
import styled, { css } from 'styled-components';

import { useCunninghamTheme } from '@/cunningham';

import { BoxProps } from './Box';

const StyledPopover = styled(Popover)`
  background-color: white;
  border-radius: var(--c--globals--spacings--st);
  box-shadow: 0 0 6px 0 rgba(0, 0, 145, 0.1);
  border: 1px solid var(--c--contextuals--border--surface--primary);
  transition: opacity var(--c--globals--transitions--duration)
    var(--c--globals--transitions--ease-out);
`;

interface StyledButtonProps {
  $css?: BoxProps['$css'];
}
const StyledButton = styled(Button)<StyledButtonProps>`
  cursor: pointer;
  border: none;
  background: none;
  outline: none;
  font-weight: var(--c--components--button--font-weight);
  font-size: var(--c--components--button--medium-font-size);
  padding: var(--c--globals--spacings--0);
  border-radius: var(--c--globals--spacings--st);
  color: var(--c--contextuals--content--semantic--brand--tertiary);
  &:hover {
    background-color: var(
      --c--contextuals--background--semantic--contextual--primary
    );
  }
  &:focus-visible {
    box-shadow: 0 0 0 2px var(--c--globals--colors--brand-400);
    background-color: var(
      --c--contextuals--background--semantic--brand--tertiary-hover
    );
    border-radius: var(--c--globals--spacings--st);
  }
  ${({ $css }) => $css};
`;

export interface DropButtonProps {
  button: ReactNode;
  buttonCss?: BoxProps['$css'];
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  label?: string;
  testId?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}

export const DropButton = ({
  button,
  buttonCss,
  isOpen = false,
  onOpenChange,
  children,
  label,
  testId,
  buttonRef,
}: PropsWithChildren<DropButtonProps>) => {
  const { themeTokens } = useCunninghamTheme();
  const font = themeTokens['font']?.['families']['base'];
  const [isLocalOpen, setIsLocalOpen] = useState(isOpen);

  const internalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = buttonRef ?? internalTriggerRef;

  useEffect(() => {
    setIsLocalOpen(isOpen);
  }, [isOpen]);

  const onOpenChangeHandler = (isOpen: boolean) => {
    setIsLocalOpen(isOpen);
    onOpenChange?.(isOpen);
  };

  return (
    <>
      <StyledButton
        ref={triggerRef}
        onPress={() => onOpenChangeHandler(true)}
        aria-label={label}
        data-testid={testId}
        $css={css`
          font-family: ${font};
          ${buttonCss};
        `}
        className="--docs--drop-button"
      >
        {button}
      </StyledButton>

      <StyledPopover
        triggerRef={triggerRef}
        isOpen={isLocalOpen}
        onOpenChange={onOpenChangeHandler}
        className="--docs--drop-button-popover"
      >
        {children}
      </StyledPopover>
    </>
  );
};
