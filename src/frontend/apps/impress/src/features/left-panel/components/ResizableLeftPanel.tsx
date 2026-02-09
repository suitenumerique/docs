import { useEffect, useRef, useState } from 'react';
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';

import { useLeftPanelStore } from '@/features/left-panel/stores';
import { useResponsiveStore } from '@/stores';

// Convert a target pixel width to a percentage of the current viewport width.
const pxToPercent = (px: number) => {
  return (px / window.innerWidth) * 100;
};

const PANEL_TOGGLE_TRANSITION =
  'flex-grow 180ms var(--c--globals--transitions--ease-out), flex-basis 180ms var(--c--globals--transitions--ease-out)';

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
  const previousPanelOpenRef = useRef<boolean>(isPanelOpen);
  const [isToggleAnimating, setIsToggleAnimating] = useState(false);

  const minPanelSizePercent = pxToPercent(minPanelSizePx);
  const maxPanelSizePercent = Math.min(pxToPercent(maxPanelSizePx), 40);
  useEffect(() => {
    const syncPanelState = () => {
      if (!ref.current || !isDesktop) {
        return;
      }

      if (!isPanelOpen) {
        ref.current.collapse();
        return;
      }

      const restoredSizePercent = Math.max(
        minPanelSizePercent,
        Math.min(pxToPercent(savedWidthPxRef.current), maxPanelSizePercent),
      );

      ref.current.expand();
      ref.current.resize(restoredSizePercent);
    };

    const hasPanelToggleChanged = previousPanelOpenRef.current !== isPanelOpen;
    previousPanelOpenRef.current = isPanelOpen;

    if (hasPanelToggleChanged) {
      setIsToggleAnimating(true);
      const animationFrameId = requestAnimationFrame(() => {
        syncPanelState();
      });
      const timeoutId = setTimeout(() => {
        setIsToggleAnimating(false);
      }, 180);

      return () => {
        window.cancelAnimationFrame(animationFrameId);
        window.clearTimeout(timeoutId);
      };
    }

    syncPanelState();

    if (!isDesktop || !isPanelOpen) {
      return;
    }

    const handleResize = () => {
      syncPanelState();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isDesktop, isPanelOpen, minPanelSizePercent, maxPanelSizePercent]);

  const handleResize = (sizePercent: number) => {
    if (isDesktop && sizePercent > 0) {
      const widthPx = (sizePercent / 100) * window.innerWidth;
      savedWidthPxRef.current = widthPx;
    }
  };

  return (
    <PanelGroup direction="horizontal">
      <Panel
        ref={ref}
        className="--docs--resizable-left-panel"
        order={0}
        collapsible
        collapsedSize={0}
        style={{
          overflow: 'hidden',
          transition: isToggleAnimating ? PANEL_TOGGLE_TRANSITION : 'none',
        }}
        defaultSize={
          isDesktop
            ? Math.max(
                minPanelSizePercent,
                Math.min(
                  pxToPercent(savedWidthPxRef.current),
                  maxPanelSizePercent,
                ),
              )
            : 0
        }
        minSize={isDesktop ? minPanelSizePercent : 0}
        maxSize={isDesktop ? maxPanelSizePercent : 0}
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
        disabled={!isDesktop || !isPanelOpen}
      />

      <Panel
        order={1}
        style={{
          transition: isToggleAnimating ? PANEL_TOGGLE_TRANSITION : 'none',
        }}
      >
        {children}
      </Panel>
    </PanelGroup>
  );
};
