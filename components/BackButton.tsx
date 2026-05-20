"use client";

import { useRouter } from "next/navigation";

/**
 * Renders a back-arrow button that pops the browser history. Used in
 * server components where we need client-side `router.back()` behavior
 * without converting the whole page to a client component.
 *
 * Falls back to `fallbackHref` if there's no history to go back to
 * (e.g., the user landed directly on this URL).
 */
export default function BackButton({
  label,
  fallbackHref,
  className,
}: {
  label: string;
  fallbackHref: string;
  className?: string;
}) {
  const router = useRouter();

  function handleClick() {
    // history.length is 1 when the user opened the URL directly. In that
    // case `router.back()` is a no-op and would strand the user — fall
    // back to a known route instead.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      ← {label}
    </button>
  );
}
