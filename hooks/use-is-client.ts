"use client";

import { useEffect, useState } from "react";

export function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setIsClient(true);
  }, []);

  return isClient;
}
