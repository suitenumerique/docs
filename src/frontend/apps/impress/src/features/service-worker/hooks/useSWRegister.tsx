import { useEffect } from 'react';

export const useSWRegister = () => {
  useEffect(() => {
    if (
      'serviceWorker' in navigator &&
      process.env.NEXT_PUBLIC_SW_DEACTIVATED !== 'true'
    ) {
      navigator.serviceWorker
        .register(`/service-worker.js?v=${process.env.NEXT_PUBLIC_BUILD_ID}`)
        .then((registration) => {
          registration.onupdatefound = () => {
            const newWorker = registration.installing;
            if (!newWorker) {
              return;
            }

            newWorker.onstatechange = () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            };
          };
        })
        .catch((err) => {
          console.error('Service worker registration failed:', err);
        });

      const currentController = navigator.serviceWorker.controller;
      const onControllerChange = () => {
        if (currentController) {
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        onControllerChange,
      );

      return () => {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          onControllerChange,
        );
      };
    }
  }, []);
};
