import { PropsWithChildren, useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

export const showEffect = `
  transform: scaleY(1);
  opacity: 1;
  max-height: 150px;
`;

export const hideEffect = `
  transform: scaleY(0);
  opacity: 0;
  max-height: 0;
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

const FadeItem = styled.div<{ $isVisible: boolean }>`
  display: flex;
  animation: ${({ $isVisible }) => ($isVisible ? fadeIn : fadeOut)} 0.2s ease
    forwards;
`;

export const FadeComponent = ({
  children,
  isVisible,
}: PropsWithChildren<{ isVisible: boolean }>) => {
  const [isGroupMounted, setIsGroupMounted] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setIsGroupMounted(true);
    }
  }, [isVisible]);

  const handleFadeOutEnd = () => {
    if (!isVisible) {
      setIsGroupMounted(false);
    }
  };

  if (!isGroupMounted) {
    return null;
  }

  return (
    <FadeItem $isVisible={isVisible} onAnimationEnd={handleFadeOutEnd}>
      {children}
    </FadeItem>
  );
};
