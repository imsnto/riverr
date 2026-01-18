
"use client";

import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // This effect runs only on the client, so window is guaranteed to be available.
    const checkDevice = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Run on mount
    checkDevice();
    
    // Add resize listener
    window.addEventListener("resize", checkDevice);

    // Cleanup listener on unmount
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  return isMobile
}
