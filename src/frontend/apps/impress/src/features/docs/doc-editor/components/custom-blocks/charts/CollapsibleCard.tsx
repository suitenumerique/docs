import React, { useState } from 'react';
import styled from 'styled-components';

import { Icon } from '@/components';

const Card = styled.div`
  background: #fff;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  border: 1px solid #e5e7eb;
`;

const CardHeader = styled.button`
  width: 100%;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 600;
  color: #111827;
`;

const CardContent = styled.div<{ isOpen: boolean }>`
  max-height: ${({ isOpen }) => (isOpen ? '1000px' : '0')};
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
  padding: ${({ isOpen }) => (isOpen ? '1rem 1.5rem' : '0 1.5rem')};
`;

type CollapsibleCardProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  children,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader onClick={() => setIsOpen((prev) => !prev)}>
        {title}
        <Icon iconName={isOpen ? 'expand_less' : 'expand_more'}></Icon>
      </CardHeader>
      <CardContent isOpen={isOpen}>{children}</CardContent>
    </Card>
  );
};
