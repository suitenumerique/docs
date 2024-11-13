import { create } from 'zustand';

export type ScreenSize = 'small-mobile' | 'mobile' | 'tablet' | 'desktop';

export interface UseResponsiveStore {
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
  isMobile: false,
  isSmallMobile: false,
  isTablet: false,
  isDesktop: false,
  screenSize: 'desktop' as ScreenSize,
  screenWidth: 0,
};

export const useResponsiveStore = create<UseResponsiveStore>((set) => ({
  isMobile: initialState.isMobile,
  isTablet: initialState.isTablet,
  isSmallMobile: initialState.isSmallMobile,
  screenSize: initialState.screenSize,
  screenWidth: initialState.screenWidth,
  setScreenSize: (size: ScreenSize) => set(() => ({ screenSize: size })),
  isDesktop: initialState.isDesktop,
  initializeResizeListener: () => {
    const resizeHandler = () => {
      const width = window.innerWidth;
      if (width < 560) {
        set({
          isDesktop: false,
          screenSize: 'small-mobile',
          isMobile: true,
          isTablet: false,
          isSmallMobile: true,
        });
      } else if (width < 768) {
        set({
          isDesktop: false,
          screenSize: 'mobile',
          isTablet: false,
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
}));
