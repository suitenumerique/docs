import { useCallback, useEffect, useRef, useState } from 'react';

const isCurrentlyFullscreen = () =>
  typeof document !== 'undefined' && !!document.fullscreenElement;

export const useBrowserFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    isCurrentlyFullscreen,
  );
  // Tracks whether the *current* fullscreen session was started by us.
  // Prevents tearing down a fullscreen the user (or OS) had already
  // entered before this hook was mounted.
  const ownedRef = useRef(false);

  useEffect(() => {
    const handleChange = () => {
      const fs = isCurrentlyFullscreen();
      // Anytime fullscreen ends — Esc, our exit(), OS — release ownership.
      if (!fs) {
        ownedRef.current = false;
      }
      setIsFullscreen(fs);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
    };
  }, []);

  const enter = useCallback(async () => {
    if (isCurrentlyFullscreen()) {
      return;
    }
    if (!document.documentElement.requestFullscreen) {
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
      ownedRef.current = true;
    } catch {
      // Browsers reject the request when not triggered by a user gesture
      // or when the API is unavailable. The presenter remains usable
      // without fullscreen, so we swallow the rejection silently.
    }
  }, []);

  const exit = useCallback(async () => {
    if (!isCurrentlyFullscreen()) {
      return;
    }
    if (!document.exitFullscreen) {
      return;
    }
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore: nothing actionable if exit fails.
    }
  }, []);

  // Same as exit() but bails out if we didn't initiate the fullscreen.
  // Use this for cleanup-on-unmount so we don't yank a user out of a
  // session they opened themselves before the presenter mounted.
  const exitIfOwned = useCallback(async () => {
    if (!ownedRef.current) {
      return;
    }
    await exit();
  }, [exit]);

  const toggle = useCallback(async () => {
    if (isCurrentlyFullscreen()) {
      await exit();
    } else {
      await enter();
    }
  }, [enter, exit]);

  return { isFullscreen, enter, exit, exitIfOwned, toggle };
};
