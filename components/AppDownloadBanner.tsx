"use client";

// AppDownloadBanner — sticky bottom bar on mobile that nudges users to
// download the Peekr app. Shows only on iOS / Android, detects the platform
// client-side to link to the correct store. Dismissable per session.

import { useEffect, useState } from "react";

type Lang = "en" | "es" | "pt";
type Platform = "ios" | "android" | "other";

const APP_STORE_URL = "https://apps.apple.com/app/id6756285989";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.peekr.peekr";
const DISMISSED_KEY = "peekr_app_banner_dismissed";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}

const copy: Record<Lang, Record<Platform | "other", { message: string; cta: string }>> = {
  es: {
    ios:     { message: "Calificá, marcá lo que viste y seguí a tus amigos.", cta: "Descargar en App Store" },
    android: { message: "Calificá, marcá lo que viste y seguí a tus amigos.", cta: "Descargar en Google Play" },
    other:   { message: "Calificá, marcá lo que viste y seguí a tus amigos.", cta: "Descargar Peekr" },
  },
  pt: {
    ios:     { message: "Avalie, acompanhe e siga seus amigos no Peekr.", cta: "Baixar na App Store" },
    android: { message: "Avalie, acompanhe e siga seus amigos no Peekr.", cta: "Baixar no Google Play" },
    other:   { message: "Avalie, acompanhe e siga seus amigos no Peekr.", cta: "Baixar Peekr" },
  },
  en: {
    ios:     { message: "Rate, track, and follow your friends on Peekr.", cta: "Get on App Store" },
    android: { message: "Rate, track, and follow your friends on Peekr.", cta: "Get on Google Play" },
    other:   { message: "Rate, track, and follow your friends on Peekr.", cta: "Download Peekr" },
  },
};

export default function AppDownloadBanner({ lang }: { lang: Lang }) {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // sessionStorage unavailable (private browsing on some browsers)
    }

    const p = detectPlatform();
    setPlatform(p);

    // Only show on actual mobile devices — no banner on desktop
    if (p === "ios" || p === "android") {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const storeUrl =
    platform === "ios"
      ? APP_STORE_URL
      : platform === "android"
      ? PLAY_STORE_URL
      : `https://www.peekr.app/${lang}/download-app`;

  const t = copy[lang][platform];

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <>
      <style>{`
        .app-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9900;
          padding: 10px 14px 16px 14px;
          background: #0e0e14;
          border-top: 1px solid rgba(255,255,255,0.09);
          display: flex;
          align-items: center;
          gap: 12px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 -4px 24px rgba(0,0,0,0.38);
        }

        .app-banner-icon {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: #FA0082;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 900;
          color: white;
          flex-shrink: 0;
          letter-spacing: -1px;
        }

        .app-banner-text {
          flex: 1;
          min-width: 0;
        }

        .app-banner-title {
          color: white;
          font-weight: 800;
          font-size: 14px;
          line-height: 1.25;
        }

        .app-banner-sub {
          color: rgba(255,255,255,0.58);
          font-size: 12px;
          line-height: 1.4;
          margin-top: 2px;
        }

        .app-banner-cta {
          background: #FA0082;
          color: white;
          text-decoration: none;
          padding: 9px 13px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 13px;
          white-space: nowrap;
          flex-shrink: 0;
          display: inline-block;
        }

        .app-banner-dismiss {
          background: none;
          border: none;
          color: rgba(255,255,255,0.38);
          font-size: 24px;
          cursor: pointer;
          padding: 2px 2px 2px 4px;
          line-height: 1;
          flex-shrink: 0;
          margin-left: -4px;
        }
      `}</style>

      <div className="app-banner" role="banner" aria-label="Download Peekr">
        <div className="app-banner-icon" aria-hidden="true">P</div>

        <div className="app-banner-text">
          <div className="app-banner-title">Peekr</div>
          <div className="app-banner-sub">{t.message}</div>
        </div>

        <a
          href={storeUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="app-banner-cta"
          onClick={dismiss}
        >
          {t.cta}
        </a>

        <button
          type="button"
          className="app-banner-dismiss"
          onClick={dismiss}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
    </>
  );
}
