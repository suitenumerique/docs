import { Input } from '@openfun/cunningham-react';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Box } from '@/components';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onClose?: () => void;
}

export const CodeEditor = ({ value, onChange, onClose }: CodeEditorProps) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] =
    React.useState<HTMLElement | null>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = `${rect.bottom + 30}px`;
      container.style.left = `${rect.left}px`;
      container.style.width = `${rect.width}px`;
      container.style.zIndex = '1000';
      document.body.appendChild(container);
      setPortalContainer(container);

      return () => {
        document.body.removeChild(container);
      };
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        portalContainer &&
        !portalContainer.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [portalContainer, onClose]);

  return (
    <>
      <div ref={anchorRef} style={{ height: '1px' }} />
      {portalContainer &&
        createPortal(
          <Box>
            <Input
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              fullWidth
            />
          </Box>,
          portalContainer,
        )}
    </>
  );
};
