import { useEffect, useRef } from 'react';

import { useLeftPanelStore } from '@/features/left-panel';
import { useRightPanelStore } from '@/features/right-panel/stores/useRightPanelStore';
import { useResponsiveStore } from '@/stores';

/**
 * Coordinates left/right panel visibility on tablet breakpoint.
 * On tablet, the place is too tight to have both panels open at the same time, so we auto-close
 * panels depending on the user actions.
 */
export function usePanelCoordination(): void {
  const { screenSize } = useResponsiveStore();
  const {
    isPanelOpen: isLeftPanelOpen,
    togglePanel: toggleLeftPanel,
    autoClose: autoCloseLeft,
  } = useLeftPanelStore();
  const {
    isPanelOpen: isRightPanelOpen,
    setActivePanel: setRightActivePanel,
    autoClose: autoCloseRight,
  } = useRightPanelStore();

  const prevScreenSizeRef = useRef(screenSize);
  const prevRightPanelOpenRef = useRef(isRightPanelOpen);

  /**
   * Case 1 – entering tablet with both panels open → auto-close left.
   * Case 2 – leaving tablet → reopen left if it was auto-closed.
   * Case 3 – right panel opens on tablet → auto-close left if open.
   * Case 4 – right panel closes on tablet → reopen left if auto-closed.
   */
  useEffect(() => {
    const prevScreenSize = prevScreenSizeRef.current;
    const prevRightOpen = prevRightPanelOpenRef.current;
    prevScreenSizeRef.current = screenSize;
    prevRightPanelOpenRef.current = isRightPanelOpen;

    // Case 1 – entering tablet
    if (screenSize === 'tablet' && prevScreenSize !== 'tablet') {
      if (isRightPanelOpen && useLeftPanelStore.getState().isPanelOpen) {
        autoCloseLeft();
      }
      return;
    }

    // Case 2 – leaving tablet
    if (screenSize !== 'tablet' && prevScreenSize === 'tablet') {
      if (useLeftPanelStore.getState().wasAutoClosed) {
        toggleLeftPanel({ type: 'desktop', value: true });
      }
      return;
    }

    // Case 3 – right opens on tablet
    if (screenSize === 'tablet' && isRightPanelOpen && !prevRightOpen) {
      if (useLeftPanelStore.getState().isPanelOpen) {
        autoCloseLeft();
      }
      return;
    }

    // Case 4 – right closes on tablet
    if (screenSize === 'tablet' && !isRightPanelOpen && prevRightOpen) {
      if (useLeftPanelStore.getState().wasAutoClosed) {
        toggleLeftPanel({ type: 'desktop', value: true });
      }
      return;
    }
  }, [screenSize, isRightPanelOpen, autoCloseLeft, toggleLeftPanel]);

  /**
   * Exception – force-open / symmetric restore.
   *
   * Left opens on tablet (right is open)  → close right (save activePanel).
   * Left closes on tablet (right was auto-closed) → reopen right.
   */
  useEffect(() => {
    if (useResponsiveStore.getState().screenSize !== 'tablet') {
      return;
    }
    if (isLeftPanelOpen) {
      // User force-opened left: close right and remember which view was active.
      if (useRightPanelStore.getState().isPanelOpen) {
        autoCloseRight();
      }
    } else {
      // User closed left: reopen right if it was auto-closed.
      const { wasAutoClosed, activePanel: savedPanel } =
        useRightPanelStore.getState();
      if (wasAutoClosed && savedPanel) {
        setRightActivePanel(savedPanel);
      }
    }
  }, [isLeftPanelOpen, autoCloseRight, setRightActivePanel]);
}
