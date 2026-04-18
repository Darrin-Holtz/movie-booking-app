export type AnalyticsPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const ANALYTICS_EVENT_NAME = "quickshow:analytics";

const canTrackInBrowser = () => typeof window !== "undefined";

export const trackEvent = (event: string, payload: AnalyticsPayload = {}) => {
  if (!canTrackInBrowser()) {
    return;
  }

  const analyticsEvent = {
    event,
    ...payload,
    path: window.location.pathname,
    search: window.location.search,
    timestamp: Date.now(),
  };

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(analyticsEvent);
  window.dispatchEvent(
    new CustomEvent(ANALYTICS_EVENT_NAME, { detail: analyticsEvent })
  );

  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics]", analyticsEvent);
  }
};

export const trackPageView = (payload: AnalyticsPayload = {}) => {
  trackEvent("page_view", {
    title: typeof document !== "undefined" ? document.title : undefined,
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    ...payload,
  });
};