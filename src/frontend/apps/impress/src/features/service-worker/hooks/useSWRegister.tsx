import { useEffect } from 'react';

export const useSWRegister = () => {
  useEffect(() => {
    if (
      !('serviceWorker' in navigator) ||
      process.env.NEXT_PUBLIC_SW_DEACTIVATED === 'true'
    ) {
      return;
    }

    const hadControllerAtStart = !!navigator.serviceWorker.controller;

    navigator.serviceWorker
      .register(`/service-worker.js`)
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

    const SW_RELOAD_KEY = 'sw-reloaded';
    let refreshing = false;
    const onControllerChange = () => {
      if (!hadControllerAtStart || refreshing) {
        return;
      }

      if (sessionStorage.getItem(SW_RELOAD_KEY) === '1') {
        sessionStorage.removeItem(SW_RELOAD_KEY);
        return;
      }

      refreshing = true;

      const doReload = () => {
        sessionStorage.setItem(SW_RELOAD_KEY, '1');
        window.location.reload();
      };

      if (document.visibilityState === 'visible') {
        doReload();
        return;
      }

      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          doReload();
        }
      };

      document.addEventListener('visibilitychange', onVisible, { once: true });
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
  }, []);
};
