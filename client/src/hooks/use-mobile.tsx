import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = React.useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  React.useEffect(() => {
    const getBreakpoint = () => {
      const width = window.innerWidth;
      if (width < MOBILE_BREAKPOINT) return 'mobile';
      if (width < TABLET_BREAKPOINT) return 'tablet';
      return 'desktop';
    };

    const onChange = () => setBreakpoint(getBreakpoint());

    window.addEventListener('resize', onChange);
    setBreakpoint(getBreakpoint());

    return () => window.removeEventListener('resize', onChange);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isMobileOrTablet: breakpoint !== 'desktop',
  };
}

// Keep existing useIsMobile for backward compatibility
export function useIsMobile() {
  const { isMobile } = useBreakpoint();
  return isMobile;
}
