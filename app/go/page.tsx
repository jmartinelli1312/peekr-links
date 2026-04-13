"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// /go?u=username        → opens peekr://u/username  → fallback: /u/username
// /go?path=/explore     → opens peekr://explore      → fallback: /explore
// /go                   → opens peekr://             → fallback: /

function buildDeepLink(params: URLSearchParams): { scheme: string; web: string } {
  const username = params.get("u");
  const path = params.get("path") ?? "/";

  if (username) {
    return {
      scheme: `peekr://u/${encodeURIComponent(username)}`,
      web: `/u/${encodeURIComponent(username)}`,
    };
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return {
    scheme: `peekr:/${cleanPath}`,
    web: cleanPath,
  };
}

function GoRedirect() {
  const params = useSearchParams();

  useEffect(() => {
    const { scheme, web } = buildDeepLink(params);
    window.location.href = scheme;
    const fallback = setTimeout(() => {
      window.location.replace(web);
    }, 800);
    return () => clearTimeout(fallback);
  }, [params]);

  return null;
}

export default function GoPage() {
  return (
    <>
      <style>{`
        .go-wrap {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #0B0B0F;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .go-card {
          text-align: center;
          padding: 24px;
        }
        .go-logo {
          font-size: 36px;
          font-weight: 900;
          letter-spacing: -0.04em;
          color: #FA0082;
          margin-bottom: 20px;
        }
        .go-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #FA0082;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .go-text {
          font-size: 15px;
          color: rgba(255,255,255,0.55);
          line-height: 1.6;
        }
      `}</style>

      <div className="go-wrap">
        <div className="go-card">
          <div className="go-logo">Peekr</div>
          <div className="go-spinner" />
          <p className="go-text">Opening Peekr…</p>
        </div>
      </div>
      <Suspense>
        <GoRedirect />
      </Suspense>
    </>
  );
}
