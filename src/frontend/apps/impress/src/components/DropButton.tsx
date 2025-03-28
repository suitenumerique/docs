import {
  PropsWithChildren,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button, Popover } from 'react-aria-components';
import styled from 'styled-components';

import { BoxProps } from './Box';

const StyledPopover = styled(Popover)`
  background-color: white;
  border-radius: 4px;
  box-shadow: 1px 1px 5px rgba(0, 0, 0, 0.1);
  border: 1px solid #dddddd;
  transition: opacity 0.2s ease-in-out;
`;

interface StyledButtonProps {
  $css?: BoxProps['$css'];
}
const StyledButton = styled(Button)<StyledButtonProps>`
  cursor: pointer;
  border: none;
  background: none;
  outline: none;
  transition: all 0.2s ease-in-out;
  font-family: Marianne, Arial, serif;
  font-weight: 500;
  font-size: 0.938rem;
  padding: 0;
  text-wrap: nowrap;
  ${({ $css }) => $css};
`;

export interface DropButtonProps {
  button: ReactNode;
  buttonCss?: BoxProps['$css'];
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  label?: string;
}

export const DropButton = ({
  button,
  buttonCss,
  isOpen = false,
  onOpenChange,
  children,
  label,
}: PropsWithChildren<DropButtonProps>) => {
  const [isLocalOpen, setIsLocalOpen] = useState(isOpen);

  const triggerRef = useRef(null);

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
        $css={buttonCss}
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
