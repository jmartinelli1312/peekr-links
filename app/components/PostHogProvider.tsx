"use client";

// PostHog provider para Next.js App Router.
//
// Por qué este patrón (y no `capture_pageview: true`):
//   PostHog-js auto-captura pageviews escuchando eventos nativos de navegación
//   (popstate / pushState). En Next.js App Router, la navegación client-side
//   NO siempre dispara esos eventos → por eso el setup original no llegaba data.
//   Solución oficial: desactivar el auto-capture y emitir manualmente un
//   `$pageview` cada vez que cambia `usePathname()` / `useSearchParams()`.

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString();
    const url = window.location.origin + pathname + (qs ? `?${qs}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

// useSearchParams() requiere Suspense boundary en App Router.
function SuspendedPostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  );
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      // Silencioso en prod; log útil en dev.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[PostHog] NEXT_PUBLIC_POSTHOG_KEY missing, skipping init");
      }
      return;
    }

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false, // Manejado manualmente en PostHogPageView
      capture_pageleave: true,
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <SuspendedPostHogPageView />
      {children}
    </PHProvider>
  );
}
