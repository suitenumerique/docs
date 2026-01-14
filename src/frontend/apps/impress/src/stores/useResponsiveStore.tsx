import { create } from 'zustand';

export type ScreenSize = 'small-mobile' | 'mobile' | 'tablet' | 'desktop';
export type InputMethod = 'touch' | 'mouse' | 'unknown';

export interface UseResponsiveStore {
  isMobile: boolean;
  isTablet: boolean;
  isSmallMobile: boolean;
  screenSize: ScreenSize;
  screenWidth: number;
  setScreenSize: (size: ScreenSize) => void;
  isDesktop: boolean;
  isTouchCapable: boolean;
  isInputTouch: boolean;
  inputMethod: InputMethod;
  initializeResizeListener: () => () => void;
  initializeInputDetection: () => () => void;
}

const initialState = {
  isMobile: false,
  isSmallMobile: false,
  isTablet: false,
  isDesktop: false,
  screenSize: 'desktop' as ScreenSize,
  screenWidth: 0,
  isTouchCapable: false,
  isInputTouch: false,
  inputMethod: 'unknown' as InputMethod,
};

export const useResponsiveStore = create<UseResponsiveStore>((set) => ({
  isDesktop: initialState.isDesktop,
  isMobile: initialState.isMobile,
  isSmallMobile: initialState.isSmallMobile,
  isTablet: initialState.isTablet,
  screenSize: initialState.screenSize,
  screenWidth: initialState.screenWidth,
  isTouchCapable: initialState.isTouchCapable,
  isInputTouch: initialState.isInputTouch,
  inputMethod: initialState.inputMethod,
  setScreenSize: (size: ScreenSize) => set(() => ({ screenSize: size })),
  initializeResizeListener: () => {
    const resizeHandler = () => {
      const width = window.innerWidth;
      if (width < 560) {
        set({
          isDesktop: false,
          screenSize: 'small-mobile',
          isMobile: true,
          isTablet: true,
          isSmallMobile: true,
        });
      } else if (width < 768) {
        set({
          isDesktop: false,
          screenSize: 'mobile',
          isTablet: true,
          isMobile: true,
          isSmallMobile: false,
        });
      } else if (width >= 768 && width < 1024) {
        set({
          isDesktop: false,
          screenSize: 'tablet',
          isTablet: true,
          isMobile: false,
          isSmallMobile: false,
        });
      } else {
        set({
          isDesktop: true,
          screenSize: 'desktop',
          isTablet: false,
          isMobile: false,
          isSmallMobile: false,
        });
      }

      set({ screenWidth: width });
    };

    const debouncedResizeHandler = () => {
      setTimeout(() => {
        resizeHandler();
      }, 300);
    };

    window.addEventListener('resize', debouncedResizeHandler);

    resizeHandler();

    return () => {
      window.removeEventListener('resize', debouncedResizeHandler);
    };
  },
  initializeInputDetection: () => {
    // Detect if device has touch capability
    const isTouchCapable =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore - for older browsers
      navigator.msMaxTouchPoints > 0;

    set({ isTouchCapable });

    // Track actual input method being used
    const handleTouchStart = () => {
      set({ inputMethod: 'touch', isInputTouch: true });
    };

    const handleMouseMove = () => {
      set({ inputMethod: 'mouse', isInputTouch: false });
    };

    // Listen for first interaction to determine input method
    window.addEventListener('touchstart', handleTouchStart, { once: false });
    window.addEventListener('mousemove', handleMouseMove, { once: false });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  },
}));
