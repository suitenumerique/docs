import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { Button, DialogTrigger, Popover } from 'react-aria-components';
import styled from 'styled-components';

const StyledPopover = styled(Popover)`
  background-color: white;
  border-radius: 4px;
  box-shadow: 1px 1px 5px rgba(0, 0, 0, 0.1);

  border: 1px solid #dddddd;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
`;

const StyledButton = styled(Button)`
  cursor: pointer;
  border: none;
  background: none;
  outline: none;
  transition: all 0.2s ease-in-out;
  font-family: Marianne, Arial, serif;
  font-weight: 500;
  font-size: 0.938rem;
  text-wrap: nowrap;
`;

export interface DropButtonProps {
  button: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export const DropButton = ({
  button,
  isOpen = false,
  onOpenChange,
  children,
}: PropsWithChildren<DropButtonProps>) => {
  const [opacity, setOpacity] = useState(false);
  const [isLocalOpen, setIsLocalOpen] = useState(isOpen);

  useEffect(() => {
    setIsLocalOpen(isOpen);
  }, [isOpen]);

  const onOpenChangeHandler = (isOpen: boolean) => {
    setIsLocalOpen(isOpen);
    onOpenChange?.(isOpen);
    setTimeout(() => {
      setOpacity(isOpen);
    }, 10);
  };

  return (
    <DialogTrigger onOpenChange={onOpenChangeHandler} isOpen={isLocalOpen}>
      <StyledButton>{button}</StyledButton>
      <StyledPopover
        style={{ opacity: opacity ? 1 : 0 }}
        isOpen={isLocalOpen}
        onOpenChange={onOpenChangeHandler}
      >
        {children}
      </StyledPopover>
    </DialogTrigger>
  );
};
