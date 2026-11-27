"use client";

import { Analytics } from "@vercel/analytics/next";

export function SiteAnalytics() {
  return (
    <Analytics beforeSend={(event) => {
      const url = new URL(event.url, window.location.origin);
      url.search = "";
      url.hash = "";
      return { ...event, url: url.href };
    }} />
  );
}
