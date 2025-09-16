import { useEffect, useRef } from 'react';

/**
 * Lazily loads children for a tree node the first time it is expanded.
 */
export const useLoadChildrenOnOpen = <T>(
  nodeId: string,
  isOpen: boolean,
  handleLoadChildren?: (id: string, signal: AbortSignal) => Promise<T[]>,
  setChildren?: (id: string, children: T[]) => void,
  isAlreadyLoaded: boolean = false,
) => {
  const hasLoadedRef = useRef(false);

  // Reset only if node changes AND it's not already loaded externally
  useEffect(() => {
    hasLoadedRef.current = isAlreadyLoaded;
  }, [nodeId, isAlreadyLoaded]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (isAlreadyLoaded || hasLoadedRef.current) {
      return;
    }
    if (!handleLoadChildren || !setChildren) {
      return;
    }

    const abortCtrl = new AbortController();
    hasLoadedRef.current = true; // prevent multiple fetches

    void handleLoadChildren(nodeId, abortCtrl.signal)
      .then((children) => {
        if (!abortCtrl.signal.aborted) {
          setChildren(nodeId, children);
        }
      })
      .catch(() => {
        // allow retry on next open
        if (!abortCtrl.signal.aborted) {
          hasLoadedRef.current = false;
        }
      });

    return () => {
      abortCtrl.abort();
    };
  }, [isOpen, nodeId, handleLoadChildren, setChildren, isAlreadyLoaded]);
};
