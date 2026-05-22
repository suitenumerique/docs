import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const RESIZE_HANDLE_ID = 'left-panel-resize-handle';

const getValueLabel = (
  current: number,
  min: number,
  max: number,
  t: (key: string) => string,
): string => {
  if (max <= min) {
    return t('Sidebar width: medium');
  }
  const ratio = (current - min) / (max - min);
  if (ratio < 1 / 3) {
    return t('Sidebar width: narrow');
  }
  if (ratio < 2 / 3) {
    return t('Sidebar width: medium');
  }
  return t('Sidebar width: wide');
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
  const { t } = useTranslation();
  const { isLargeScreen } = useResponsiveStore();
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

  const [isMounting, setIsMounting] = useState(false);

  /**
   * To avoid flickering animation on initial load
   */
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsMounting(true);
    }, 500);

    return () => {
      clearTimeout(timeout);
      setIsMounting(false);
    };
  }, []);

  /**
   * When the panel is toggled open/closed, we want
   * to either expand/collapse
   */
  useEffect(() => {
    if (!ref.current || !isLargeScreen) {
      return;
    }
    if (isPanelOpen) {
      ref.current.expand();
    } else {
      ref.current.collapse();
    }
  }, [isPanelOpen, isLargeScreen]);

  // Keep pixel width constant on window resize
  useEffect(() => {
    if (!isLargeScreen) {
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
  }, [isLargeScreen]);

  /**
   * Workaround: NVDA does not enter focus mode for role="separator"
   * (https://github.com/nvaccess/nvda/issues/11403), so arrow keys are
   * intercepted by browse-mode navigation and never reach the handle.
   * Changing the role to "slider" makes NVDA reliably switch to focus
   * mode, restoring progressive keyboard resize with arrow keys.
   *
   * Note: PanelResizeHandle does not expose a ref (no RefAttributes in its
   * type definition), so we use id + getElementById as the only viable option.
   * Only role needs to be overridden here; aria-* props are passed directly.
   */
  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }
    document.getElementById(RESIZE_HANDLE_ID)?.setAttribute('role', 'slider');
  }, [isPanelOpen]);

  const handleResize = (sizePercent: number) => {
    const widthPx = (sizePercent / 100) * window.innerWidth;
    savedWidthPxRef.current = widthPx;
    setPanelSizePercent(sizePercent);
  };

  return (
    <PanelGroup direction="horizontal" keyboardResizeBy={1}>
      <Panel
        ref={ref}
        className="--docs--resizable-left-panel"
        inert={!isPanelOpen}
        collapsible={!isPanelOpen}
        collapsedSize={0}
        style={{
          transition:
            isDragging || !isMounting
              ? 'none'
              : 'flex var(--c--globals--transitions--duration) var(--c--globals--transitions--ease-out)',
        }}
        order={0}
        defaultSize={
          isLargeScreen
            ? Math.max(
                minPanelSizePercent,
                Math.min(panelSizePercent, maxPanelSizePercent),
              )
            : 0
        }
        minSize={isLargeScreen ? minPanelSizePercent : 0}
        maxSize={isLargeScreen ? maxPanelSizePercent : 0}
        onResize={handleResize}
      >
        {leftPanel}
      </Panel>
      {isPanelOpen && (
        <PanelResizeHandle
          id={RESIZE_HANDLE_ID}
          aria-label={t('Resize sidebar')}
          aria-orientation="horizontal"
          aria-valuemin={Math.round(minPanelSizePercent)}
          aria-valuemax={Math.round(maxPanelSizePercent)}
          aria-valuenow={Math.round(panelSizePercent)}
          aria-valuetext={getValueLabel(
            panelSizePercent,
            minPanelSizePercent,
            maxPanelSizePercent,
            t,
          )}
          style={{
            borderRightWidth: '1px',
            borderRightStyle: 'solid',
            borderRightColor: 'var(--c--contextuals--border--surface--primary)',
            width: '1px',
            cursor: 'col-resize',
          }}
          onDragging={setIsDragging}
          disabled={!isLargeScreen}
        />
      )}
      <Panel order={1}>{children}</Panel>
    </PanelGroup>
  );
};
