"use client";

// PostHog provider para Next.js App Router.
//
// Por qué este patrón:
//   1. PostHog-js auto-capture (capture_pageview: true) no funciona en App
//      Router porque la navegación client-side no dispara los eventos que
//      posthog-js escucha. Emitimos manualmente en base a usePathname().
//
//   2. Usamos `usePostHog()` del SDK de React (no el import directo de
//      `posthog`) para evitar el race condition típico: los useEffect de
//      los componentes hijos corren ANTES que los del padre, así que si
//      el hijo llama a `posthog.capture()` antes de que el padre ejecute
//      `posthog.init()`, el primer pageview se pierde. El hook se encarga
//      de esperar a que la instancia esté lista.

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!pathname || !ph) return;
    const qs = searchParams?.toString();
    const url = window.location.origin + pathname + (qs ? `?${qs}` : "");
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

// useSearchParams() requiere un Suspense boundary en App Router.
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
