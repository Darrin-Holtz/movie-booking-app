"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageView } from "@/lib/analytics";

const AnalyticsProvider = () => {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView({ pathname });
  }, [pathname]);

  return null;
};

export default AnalyticsProvider;