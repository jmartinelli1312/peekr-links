"use client";

import { useEffect } from "react";

/**
 * Smart app-open bounce for email links.
 *
 * The weekly email's title links carry `?src=app`. When such a link opens this
 * web /title page (directly, or after Resend's click-tracking redirect), we try
 * to open the native app at `peekr://title/<type>/<id>`. If the app is
 * installed the OS switches to it; if not, the user just stays on this page.
 *
 * Only fires on mobile AND only when `?src=app` is present, so SEO / desktop /
 * organic visits are never affected. Universal links can't be triggered from a
 * redirect (which is why click tracking broke them) — the custom scheme works
 * from the loaded page regardless.
 */
export default function AppBounce({
  type,
  id,
}: {
  type: string;
  id: string | number;
}) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("src") !== "app") return;

    const ua = navigator.userAgent || "";
    const isAndroid = /android/i.test(ua);
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!isAndroid && !isIOS) return;

    // Drop ?src=app so a refresh / back / share doesn't re-trigger the bounce.
    params.delete("src");
    const cleanUrl =
      window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState(null, "", cleanUrl);

    const path = `title/${type}/${id}`;
    if (isAndroid) {
      // Opens the app if installed; browser_fallback_url keeps the user on this
      // web page otherwise (no error page, no Play Store bounce).
      const fallback = encodeURIComponent(window.location.href);
      window.location.href =
        `intent://${path}#Intent;scheme=peekr;package=com.peekr.peekr;` +
        `S.browser_fallback_url=${fallback};end`;
    } else {
      // iOS: attempt the custom scheme. Installed → app opens; not installed →
      // stay on web (a brief system prompt may flash).
      window.location.href = `peekr://${path}`;
    }
  }, [type, id]);

  return null;
}
