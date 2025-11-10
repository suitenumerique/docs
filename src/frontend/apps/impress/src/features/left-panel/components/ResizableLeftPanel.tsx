import { useEffect, useRef, useState } from 'react';
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { createGlobalStyle } from 'styled-components';

import { useCunninghamTheme } from '@/cunningham';

interface PanelStyleProps {
  $isResizing: boolean;
}

const PanelStyle = createGlobalStyle<PanelStyleProps>`
  ${({ $isResizing }) => $isResizing && `body * { transition: none !important; }`}
`;

// Convert a target pixel width to a percentage of the current viewport width.
// react-resizable-panels expects sizes in %, not px.
const calculateDefaultSize = (targetWidth: number) => {
  const windowWidth = window.innerWidth;
  return (targetWidth / windowWidth) * 100;
};

type ResizableLeftPanelProps = {
  leftPanel: React.ReactNode;
  children: React.ReactNode;
  minPanelSizePx?: number;
  maxPanelSizePx?: number;
};

export const ResizableLeftPanel = ({
  leftPanel,
  children,
  minPanelSizePx = 300,
  maxPanelSizePx = 450,
}: ResizableLeftPanelProps) => {
  const [isResizing, setIsResizing] = useState(false);
  const { colorsTokens } = useCunninghamTheme();
  const ref = useRef<ImperativePanelHandle>(null);
  const resizeTimeoutRef = useRef<number | undefined>(undefined);

  const [minPanelSize, setMinPanelSize] = useState(0);
  const [maxPanelSize, setMaxPanelSize] = useState(0);

  // Single resize listener that handles both panel size updates and transition disabling
  useEffect(() => {
    const handleResize = () => {
      // Update panel sizes (px -> %)
      const min = Math.round(calculateDefaultSize(minPanelSizePx));
      const max = Math.round(
        Math.min(calculateDefaultSize(maxPanelSizePx), 40),
      );
      setMinPanelSize(min);
      setMaxPanelSize(max);

      // Temporarily disable transitions to avoid flicker
      setIsResizing(true);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        setIsResizing(false);
      }, 150);
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [minPanelSizePx, maxPanelSizePx]);

  return (
    <>
      <PanelStyle $isResizing={isResizing} />
      <PanelGroup
        autoSaveId="docs-left-panel-persistence"
        direction="horizontal"
      >
        <Panel
          ref={ref}
          order={0}
          defaultSize={minPanelSize}
          minSize={minPanelSize}
          maxSize={maxPanelSize}
        >
          {leftPanel}
        </Panel>
        <PanelResizeHandle
          style={{
            borderRightWidth: '1px',
            borderRightStyle: 'solid',
            borderRightColor: colorsTokens['greyscale-200'],
            width: '1px',
            cursor: 'col-resize',
          }}
        />
        <Panel order={1}>{children}</Panel>
      </PanelGroup>
    </>
  );
};
