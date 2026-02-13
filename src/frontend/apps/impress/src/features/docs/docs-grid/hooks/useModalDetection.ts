import { useEffect, useState } from 'react';

let observer: MutationObserver | null = null;
let listeners = new Set<(isOpen: boolean) => void>();
let currentModalState = false;

const checkModal = () => {
  const modalOpen = !!document.querySelector('[role="dialog"]');
  if (modalOpen !== currentModalState) {
    currentModalState = modalOpen;
    listeners.forEach((listener) => listener(modalOpen));
  }
};

const initObserver = () => {
  if (!observer) {
    observer = new MutationObserver(checkModal);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
};

const cleanupObserver = () => {
  if (observer && listeners.size === 0) {
    observer.disconnect();
    observer = null;
  }
};

export const useModalDetection = () => {
  const [isModalOpen, setIsModalOpen] = useState(currentModalState);

  useEffect(() => {
    // Initialize observer if this is the first listener
    if (listeners.size === 0) {
      initObserver();
      checkModal(); // Check immediately
    }

    // Add this component's listener
    listeners.add(setIsModalOpen);

    // Set initial state
    setIsModalOpen(currentModalState);

    return () => {
      // Remove this component's listener
      listeners.delete(setIsModalOpen);
      // Cleanup observer if this was the last listener
      cleanupObserver();
    };
  }, []);

  return isModalOpen;
};
