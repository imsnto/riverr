
"use client";

import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Initialize with a default value to prevent undefined state on first render.
  // This avoids components returning null and causing layout shifts that can close modals.
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    // This effect runs only on the client, so window is guaranteed to be available.
    const checkDevice = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Run on mount to get the correct initial value on the client.
    checkDevice();
    
    // Add resize listener
    window.addEventListener("resize", checkDevice);

    // Cleanup listener on unmount
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  return isMobile
}
