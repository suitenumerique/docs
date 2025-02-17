import { FocusScope } from '@react-aria/focus';
import {
  PropsWithChildren,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button, Popover } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

const StyledPopover = styled(Popover)`
  background-color: white;
  border-radius: 4px;
  box-shadow: 1px 1px 5px rgba(0, 0, 0, 0.1);
  border: 1px solid #dddddd;
  transition: opacity 0.2s ease-in-out;
  padding: 1rem;
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
  padding: 0;
  text-wrap: nowrap;

  &:focus-within {
    outline: 2px solid #007bff;
  }
`;

export interface DropButtonProps {
  button: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  label?: string;
}

export const DropButton = ({
  button,
  isOpen = false,
  onOpenChange,
  children,
}: PropsWithChildren<DropButtonProps>) => {
  const { t } = useTranslation();
  const [isLocalOpen, setIsLocalOpen] = useState(isOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isLocalOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isLocalOpen]);

  const onOpenChangeHandler = (isOpen: boolean) => {
    setIsLocalOpen(isOpen);
    onOpenChange?.(isOpen);
  };

  return (
    <>
      <StyledButton
        ref={triggerRef}
        onPress={() => onOpenChangeHandler(true)}
        aria-haspopup="true"
        aria-expanded={isLocalOpen}
        aria-label={t('Open the document options')}
      >
        <span aria-hidden="true">{button}</span>
      </StyledButton>

      {isLocalOpen && (
        <StyledPopover
          triggerRef={triggerRef}
          isOpen={isLocalOpen}
          onOpenChange={onOpenChangeHandler}
        >
          <FocusScope contain restoreFocus>
            {children}
            <button
              ref={firstFocusableRef}
              onClick={() => setIsLocalOpen(false)}
            >
              {t('Close the modal')}
            </button>
          </FocusScope>
        </StyledPopover>
      )}
    </>
  );
};
