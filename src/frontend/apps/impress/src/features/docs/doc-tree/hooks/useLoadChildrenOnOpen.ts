import { useEffect, useRef } from 'react';

/**
 * Lazily loads children for a tree node the first time it is expanded.
 * Works for both mouse and keyboard expansions.
 */
export const useLoadChildrenOnOpen = <T>(
  nodeId: string,
  isOpen: boolean,
  handleLoadChildren?: (id: string) => Promise<T[]>,
  setChildren?: (id: string, children: T[]) => void,
  isAlreadyLoaded?: boolean,
) => {
  const hasLoadedRef = useRef(false);

  // Reset the local loaded flag when the node id changes
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [nodeId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (isAlreadyLoaded) {
      hasLoadedRef.current = true;
      return;
    }
    if (hasLoadedRef.current) {
      return;
    }
    if (!handleLoadChildren || !setChildren) {
      return;
    }

    let isCancelled = false;
    // Mark as loading to prevent repeated fetches/renders that can cause flicker
    hasLoadedRef.current = true;
    void handleLoadChildren(nodeId)
      .then((children) => {
        if (isCancelled) {
          return;
        }
        setChildren(nodeId, children);
      })
      .catch(() => {
        // allow retry on next open
        hasLoadedRef.current = false;
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, nodeId, handleLoadChildren, setChildren, isAlreadyLoaded]);
};
