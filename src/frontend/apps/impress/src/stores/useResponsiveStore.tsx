import { create } from 'zustand';

export type ScreenSize = 'small-mobile' | 'mobile' | 'tablet' | 'desktop';

export const MOBILE_BREAKPOINT = 768;

export const BREAKPOINTS = {
  SMALL_MOBILE: 560,
  MOBILE: MOBILE_BREAKPOINT,
  TABLET: 1024,
} as const;

export interface UseResponsiveStore {
  isLargeScreen: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isSmallMobile: boolean;
  screenSize: ScreenSize;
  screenWidth: number;
  setScreenSize: (size: ScreenSize) => void;
  isDesktop: boolean;
  /**
   * Indicates whether the primary input device has a coarse pointer (e.g., a touchscreen)
   * rather than a fine pointer (e.g., a mouse or trackpad).
   */
  hasCoarsePointer: boolean;
  initializeResizeListener: () => () => void;
}

const initialState = {
  isLargeScreen: false,
  isMobile: false,
  isSmallMobile: false,
  isTablet: false,
  isDesktop: false,
  hasCoarsePointer: false,
  screenSize: 'desktop' as ScreenSize,
  screenWidth: 0,
};

export const useResponsiveStore = create<UseResponsiveStore>((set) => ({
  isDesktop: initialState.isDesktop,
  isLargeScreen: initialState.isLargeScreen,
  isMobile: initialState.isMobile,
  isSmallMobile: initialState.isSmallMobile,
  isTablet: initialState.isTablet,
  hasCoarsePointer: initialState.hasCoarsePointer,
  screenSize: initialState.screenSize,
  screenWidth: initialState.screenWidth,
  setScreenSize: (size: ScreenSize) => set(() => ({ screenSize: size })),
  initializeResizeListener: () => {
    let pendingResize = false;

    const resizeHandler = () => {
      const width = window.innerWidth;
      if (width < BREAKPOINTS.SMALL_MOBILE) {
        set({
          isDesktop: false,
          screenSize: 'small-mobile',
          isMobile: true,
          isTablet: true,
          isSmallMobile: true,
          isLargeScreen: false,
          screenWidth: width,
        });
      } else if (width < BREAKPOINTS.MOBILE) {
        set({
          isDesktop: false,
          screenSize: 'mobile',
          isTablet: true,
          isMobile: true,
          isSmallMobile: false,
          isLargeScreen: false,
          screenWidth: width,
        });
      } else if (width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.TABLET) {
        set({
          isDesktop: false,
          isLargeScreen: true,
          screenSize: 'tablet',
          isTablet: true,
          isMobile: false,
          isSmallMobile: false,
          screenWidth: width,
        });
      } else {
        set({
          isDesktop: true,
          isLargeScreen: true,
          screenSize: 'desktop',
          isTablet: false,
          isMobile: false,
          isSmallMobile: false,
          screenWidth: width,
        });
      }
    };

    let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
    const debouncedResizeHandler = () => {
      if (pendingResize) {
        return;
      }

      pendingResize = true;
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resizeHandler();
        pendingResize = false;
      }, 200);
    };

    window.addEventListener('resize', debouncedResizeHandler);

    resizeHandler();

    // Listen for changes to the primary input device's pointer type (coarse vs fine).
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    const pointerHandler = () => {
      set({ hasCoarsePointer: coarsePointerQuery.matches });
    };
    pointerHandler();
    coarsePointerQuery.addEventListener('change', pointerHandler);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', debouncedResizeHandler);
      coarsePointerQuery.removeEventListener('change', pointerHandler);
    };
  },
}));
