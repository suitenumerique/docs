import {
  ToastProviderContext,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useCallback, useRef } from 'react';

/**
 * Keep a stable identity for the toast functions. Listing an unstable one as
 * a dependency once remounted the BlockNote editor (and reset its scroll)
 * whenever an unrelated toast fired. The kit memoizes its context, but this
 * wrapper stays so a future recreation cannot do that again.
 */
export const useToast = (): ToastProviderContext => {
  const { toast, updateToast, dismissToast } = useToastProvider();
  const toastRef = useRef(toast);
  const updateToastRef = useRef(updateToast);
  const dismissToastRef = useRef(dismissToast);
  toastRef.current = toast;
  updateToastRef.current = updateToast;
  dismissToastRef.current = dismissToast;

  const stableToast = useCallback<ToastProviderContext['toast']>(
    (...args) => toastRef.current(...args),
    [],
  );
  const stableUpdateToast = useCallback<ToastProviderContext['updateToast']>(
    (...args) => updateToastRef.current(...args),
    [],
  );
  const stableDismissToast = useCallback<ToastProviderContext['dismissToast']>(
    (...args) => dismissToastRef.current(...args),
    [],
  );

  return {
    toast: stableToast,
    updateToast: stableUpdateToast,
    dismissToast: stableDismissToast,
  };
};
