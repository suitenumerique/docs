import {
  ToastProviderContext,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useCallback, useRef } from 'react';

/**
 * The provider's `toast` function is recreated every time any toast is shown
 * anywhere in the app, which breaks memoization for anything that lists it as
 * a dependency - it once caused the BlockNote editor to fully remount (and
 * reset scroll) whenever an unrelated toast fired. Use this instead of
 * `useToastProvider` directly to get a `toast` with a stable identity.
 *
 * @TODO Modify the ui-components library to provide a stable toast function directly.
 */
export const useToast = (): ToastProviderContext => {
  const { toast } = useToastProvider();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const stableToast = useCallback<ToastProviderContext['toast']>(
    (...args) => toastRef.current(...args),
    [],
  );

  return { toast: stableToast };
};
