import { useEffect, useRef, useState } from 'react';
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';

import { useResponsiveStore } from '@/stores';

import { useLeftPanelStore } from '../stores';

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
  const { isDesktop } = useResponsiveStore();
  const { isPanelOpen } = useLeftPanelStore();
  const ref = useRef<ImperativePanelHandle>(null);
  const savedWidthPxRef = useRef<number>(minPanelSizePx);
  const [isDragging, setIsDragging] = useState(false);

  const minPanelSizePercent = pxToPercent(minPanelSizePx);
  const maxPanelSizePercent = Math.min(pxToPercent(maxPanelSizePx), 40);

  const [panelSizePercent, setPanelSizePercent] = useState(() => {
    const initialSize = pxToPercent(minPanelSizePx);
    return Math.max(
      minPanelSizePercent,
      Math.min(initialSize, maxPanelSizePercent),
    );
  });

  /**
   * When the panel is toggled open/closed, we want
   * to either expand/collapse
   */
  useEffect(() => {
    if (!ref.current || !isDesktop) {
      return;
    }
    if (isPanelOpen) {
      ref.current.expand();
    } else {
      ref.current.collapse();
    }
  }, [isPanelOpen, isDesktop]);

  // Keep pixel width constant on window resize
  useEffect(() => {
    if (!isDesktop) {
      return;
    }

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
  }, [isDesktop]);

  const handleResize = (sizePercent: number) => {
    const widthPx = (sizePercent / 100) * window.innerWidth;
    savedWidthPxRef.current = widthPx;
    setPanelSizePercent(sizePercent);
  };

  return (
    <PanelGroup direction="horizontal">
      <Panel
        ref={ref}
        className="--docs--resizable-left-panel"
        collapsible={!isPanelOpen}
        collapsedSize={0}
        style={{
          transition: isDragging
            ? 'none'
            : 'flex 250ms var(--c--globals--transitions--ease-out)',
        }}
        order={0}
        defaultSize={
          isDesktop
            ? Math.max(
                minPanelSizePercent,
                Math.min(panelSizePercent, maxPanelSizePercent),
              )
            : 0
        }
        minSize={isDesktop ? minPanelSizePercent : 0}
        maxSize={isDesktop ? maxPanelSizePercent : 0}
        onResize={handleResize}
      >
        {leftPanel}
      </Panel>
      {isPanelOpen && (
        <PanelResizeHandle
          style={{
            borderRightWidth: '1px',
            borderRightStyle: 'solid',
            borderRightColor: 'var(--c--contextuals--border--surface--primary)',
            width: '1px',
            cursor: 'col-resize',
          }}
          onDragging={setIsDragging}
          disabled={!isDesktop}
        />
      )}
      <Panel order={1}>{children}</Panel>
    </PanelGroup>
  );
};
