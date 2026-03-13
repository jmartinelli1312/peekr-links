"use client";

import { useEffect } from "react";

export default function AppRedirect({
  type,
  id,
}: {
  type: string;
  id: string;
}) {
  useEffect(() => {
    const appUrl = `peekr://title/${type}/${id}`;
    const fallback = process.env.NEXT_PUBLIC_TESTFLIGHT_URL;

    window.location.href = appUrl;

    const t = setTimeout(() => {
      if (fallback) {
        window.location.href = fallback;
      }
    }, 1500);

    return () => clearTimeout(t);
  }, [type, id]);

  return null;
}
