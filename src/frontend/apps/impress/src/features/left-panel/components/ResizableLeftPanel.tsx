import { useEffect, useRef, useState } from 'react';
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';

// Convert a target pixel width to a percentage of the current viewport width.
const pxToPercent = (px: number) => {
  return (px / window.innerWidth) * 100;
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
  const ref = useRef<ImperativePanelHandle>(null);
  const savedWidthPxRef = useRef<number>(minPanelSizePx);

  const [panelSizePercent, setPanelSizePercent] = useState(() =>
    pxToPercent(minPanelSizePx),
  );

  const minPanelSizePercent = pxToPercent(minPanelSizePx);
  const maxPanelSizePercent = Math.min(pxToPercent(maxPanelSizePx), 40);

  // Keep pixel width constant on window resize
  useEffect(() => {
    const handleResize = () => {
      const newPercent = pxToPercent(savedWidthPxRef.current);
      setPanelSizePercent(newPercent);
      if (ref.current) {
        ref.current.resize?.(newPercent - (ref.current.getSize() || 0));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleResize = (sizePercent: number) => {
    const widthPx = (sizePercent / 100) * window.innerWidth;
    savedWidthPxRef.current = widthPx;
    setPanelSizePercent(sizePercent);
  };

  return (
    <>
      <PanelGroup direction="horizontal">
        <Panel
          ref={ref}
          order={0}
          defaultSize={panelSizePercent}
          minSize={minPanelSizePercent}
          maxSize={maxPanelSizePercent}
          onResize={handleResize}
        >
          {leftPanel}
        </Panel>
        <PanelResizeHandle
          style={{
            borderRightWidth: '1px',
            borderRightStyle: 'solid',
            borderRightColor: 'var(--c--contextuals--border--surface--primary)',
            width: '1px',
            cursor: 'col-resize',
          }}
        />
        <Panel order={1}>{children}</Panel>
      </PanelGroup>
    </>
  );
};
