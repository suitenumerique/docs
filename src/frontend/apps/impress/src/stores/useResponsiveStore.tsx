import { create } from 'zustand';

export type ScreenSize = 'small-mobile' | 'mobile' | 'tablet' | 'desktop';

export interface UseResponsiveStore {
  isLargeScreen: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isSmallMobile: boolean;
  screenSize: ScreenSize;
  screenWidth: number;
  setScreenSize: (size: ScreenSize) => void;
  isDesktop: boolean;
  initializeResizeListener: () => () => void;
}

const initialState = {
  isLargeScreen: false,
  isMobile: false,
  isSmallMobile: false,
  isTablet: false,
  isDesktop: false,
  screenSize: 'desktop' as ScreenSize,
  screenWidth: 0,
};

export const useResponsiveStore = create<UseResponsiveStore>((set) => ({
  isDesktop: initialState.isDesktop,
  isLargeScreen: initialState.isLargeScreen,
  isMobile: initialState.isMobile,
  isSmallMobile: initialState.isSmallMobile,
  isTablet: initialState.isTablet,
  screenSize: initialState.screenSize,
  screenWidth: initialState.screenWidth,
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
          isLargeScreen: false,
        });
      } else if (width < 768) {
        set({
          isDesktop: false,
          screenSize: 'mobile',
          isTablet: true,
          isMobile: true,
          isSmallMobile: false,
          isLargeScreen: false,
        });
      } else if (width >= 768 && width < 1024) {
        set({
          isDesktop: false,
          isLargeScreen: true,
          screenSize: 'tablet',
          isTablet: true,
          isMobile: false,
          isSmallMobile: false,
        });
      } else {
        set({
          isDesktop: true,
          isLargeScreen: true,
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
}));
