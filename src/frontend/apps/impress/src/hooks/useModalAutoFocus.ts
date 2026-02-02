import { DependencyList, RefObject, useEffect } from 'react';

const DEFAULT_DEPS: DependencyList = [];

interface UseModalAutoFocusOptions {
  delay?: number;
  deps?: DependencyList;
}

export const useModalAutoFocus = (
  ref: RefObject<HTMLElement | null>,
  { delay = 100, deps = DEFAULT_DEPS }: UseModalAutoFocusOptions = {},
) => {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      ref.current?.focus();
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [ref, delay, deps]);
};
