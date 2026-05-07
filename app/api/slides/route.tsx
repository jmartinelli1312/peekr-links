/**
 * /api/slides — Instagram carousel slide renderer (1080×1350, 4:5)
 *
 * Query params:
 *   type    – actualidad | actor | lanzamiento | reco
 *   slide   – 1 | 2 | 3 | 4
 *   hook    – headline / hook text (slide 1)
 *   point   – single bullet point text (slides 2-3)
 *   img     – absolute URL for hero image (slide 1, optional)
 *   title   – seed title / actor name
 *   source  – "via CinemaCómics" attribution text
 *   lang    – es | pt  (default: es)
 */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type { ReactElement } from "react";

export const runtime = "edge";

const W = 1080;
const H = 1350;

// ─── Theme per carousel type ──────────────────────────────────────
type CarouselType = "actualidad" | "actor" | "lanzamiento" | "reco";

interface Theme {
  accent: string;      // primary accent hex
  accentB: string;     // darker accent for gradients
  bg: string;          // main background
  bgCard: string;      // card / panel background
  label: string;       // short type label in Spanish
  labelPt: string;     // short type label in Portuguese
  emoji: string;
  ctaEs: string;
  ctaPt: string;
  grad1: string;       // gradient stop 1
  grad2: string;       // gradient stop 2
}

const THEMES: Record<CarouselType, Theme> = {
  actualidad: {
    accent:   "#22D3EE",
    accentB:  "#0891B2",
    bg:       "#020A0E",
    bgCard:   "#061419",
    label:    "NOTICIAS",
    labelPt:  "NOTÍCIAS",
    emoji:    "📰",
    ctaEs:    "Más noticias de cine y series",
    ctaPt:    "Mais notícias de cinema e séries",
    grad1:    "#22D3EE",
    grad2:    "#0284C7",
  },
  actor: {
    accent:   "#C084FC",
    accentB:  "#9333EA",
    bg:       "#0B0615",
    bgCard:   "#140828",
    label:    "PROTAGONISTA",
    labelPt:  "PROTAGONISTA",
    emoji:    "🎭",
    ctaEs:    "Descubre a los protagonistas del cine",
    ctaPt:    "Descubra os protagonistas do cinema",
    grad1:    "#C084FC",
    grad2:    "#7C3AED",
  },
  lanzamiento: {
    accent:   "#FB923C",
    accentB:  "#C2410C",
    bg:       "#0A0300",
    bgCard:   "#160600",
    label:    "ESTRENO",
    labelPt:  "ESTREIA",
    emoji:    "🎬",
    ctaEs:    "Descubre qué ver este fin de semana",
    ctaPt:    "Descubra o que assistir neste fim de semana",
    grad1:    "#FB923C",
    grad2:    "#B45309",
  },
  reco: {
    accent:   "#4ADE80",
    accentB:  "#15803D",
    bg:       "#010D04",
    bgCard:   "#021808",
    label:    "RECOMENDACIÓN",
    labelPt:  "RECOMENDAÇÃO",
    emoji:    "✨",
    ctaEs:    "Descubre qué ver en PeekrBuzz",
    ctaPt:    "Descubra o que assistir no PeekrBuzz",
    grad1:    "#4ADE80",
    grad2:    "#15803D",
  },
};

// ─── Font loading ─────────────────────────────────────────────────
// Satori (ImageResponse) supports TTF / WOFF — NOT WOFF2.
// We use @fontsource/inter v4 which ships .woff files.
// Cached at module level – edge runtime reuses warm instances.
let _inter400: ArrayBuffer | null = null;
let _inter700: ArrayBuffer | null = null;
let _inter800: ArrayBuffer | null = null;

async function loadFonts() {
  if (!_inter400 || !_inter700 || !_inter800) {
    // v4.5.15 provides .woff (not woff2) — Satori-compatible
    const base =
      "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files";
    const results = await Promise.allSettled([
      fetch(`${base}/inter-latin-400-normal.woff`).then((r) => r.arrayBuffer()),
      fetch(`${base}/inter-latin-700-normal.woff`).then((r) => r.arrayBuffer()),
      fetch(`${base}/inter-latin-800-normal.woff`).then((r) => r.arrayBuffer()),
    ]);
    _inter400 =
      results[0].status === "fulfilled" ? results[0].value : null;
    _inter700 =
      results[1].status === "fulfilled" ? results[1].value : null;
    _inter800 =
      results[2].status === "fulfilled" ? results[2].value : null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fonts: any[] = [];
  if (_inter400)
    fonts.push({ name: "Inter", data: _inter400, weight: 400, style: "normal" });
  if (_inter700)
    fonts.push({ name: "Inter", data: _inter700, weight: 700, style: "normal" });
  if (_inter800)
    fonts.push({ name: "Inter", data: _inter800, weight: 800, style: "normal" });
  return fonts;
}

// ─── Shared micro-components ──────────────────────────────────────

/** Four progress pills — current slide wider and filled */
function ProgressDots(slide: number, accent: string) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          style={{
            width: i === slide ? 32 : 12,
            height: 12,
            borderRadius: 99,
            background:
              i === slide ? accent : "rgba(255,255,255,0.22)",
          }}
        />
      ))}
    </div>
  );
}

/** Peekr "P" mark + wordmark */
function PeekrBrand(accent: string) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 800,
          color: "#000",
          fontFamily: "Inter",
        }}
      >
        P
      </div>
      <span
        style={{
          color: "rgba(255,255,255,0.75)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 3,
          fontFamily: "Inter",
        }}
      >
        PEEKR
      </span>
    </div>
  );
}

/** Type badge pill */
function TypeBadge(emoji: string, label: string, accent: string) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(0,0,0,0.55)",
        border: `1.5px solid ${accent}`,
        borderRadius: 99,
        padding: "8px 22px",
      }}
    >
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span
        style={{
          color: accent,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 3,
          fontFamily: "Inter",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** Horizontal divider */
function AccentLine(accent: string, width = 80) {
  return (
    <div
      style={{
        width,
        height: 3,
        borderRadius: 99,
        background: accent,
      }}
    />
  );
}

// ─── Slide 1: Hero / Hook ─────────────────────────────────────────
// Full-bleed image at top half, gradient fade, big hook text below
function Slide1(
  t: Theme,
  type: CarouselType,
  hook: string,
  img: string,
  source: string,
  lang: "es" | "pt"
) {
  const label = lang === "pt" ? t.labelPt : t.label;
  const hasImage = img.length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        background: t.bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
      }}
    >
      {/* ── Hero image (top 68%) ── */}
      {hasImage ? (
        <img
          src={img}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: 920,
            objectFit: "cover",
            objectPosition: "center top",
          }}
        />
      ) : (
        /* Gradient fallback when no image */
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: 920,
            backgroundImage: `linear-gradient(160deg, ${t.bgCard} 0%, ${t.accentB}22 60%, ${t.bg} 100%)`,
          }}
        />
      )}

      {/* ── Gradient overlay (image → bg) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: W,
          height: 900,
          backgroundImage: `linear-gradient(to bottom, transparent 0%, ${t.bg}CC 45%, ${t.bg} 75%)`,
        }}
      />

      {/* ── Top bar: brand + badge ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "40px 54px",
        }}
      >
        {PeekrBrand(t.accent)}
        {TypeBadge(t.emoji, label, t.accent)}
      </div>

      {/* ── Bottom content block ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          padding: "0 64px 64px",
          gap: 22,
        }}
      >
        {/* Accent line */}
        {AccentLine(t.accent, 72)}

        {/* Hook headline */}
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 66,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -0.5,
            maxWidth: 960,
          }}
        >
          {hook || "Titular de la noticia de cine"}
        </div>

        {/* Source + dots row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {source ? (
            <span
              style={{
                color: t.accent,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: 1,
                opacity: 0.9,
              }}
            >
              via {source}
            </span>
          ) : (
            <div style={{ display: "flex" }} />
          )}
          {ProgressDots(1, t.accent)}
        </div>
      </div>

      {/* ── Type-specific decorative corner ── */}
      {type === "actualidad" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 6,
            height: "100%",
            backgroundImage: `linear-gradient(to bottom, ${t.accent}00, ${t.accent}88, ${t.accent}00)`,
          }}
        />
      )}
      {type === "actor" && (
        /* Spotlight radial behind image */
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "50%",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${t.accentB}33 0%, transparent 70%)`,
          }}
        />
      )}
      {type === "lanzamiento" && (
        /* Diagonal streak top-right */
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 320,
            height: 8,
            background: t.accent,
            transformOrigin: "right top",
          }}
        />
      )}
    </div>
  );
}

// ─── Slide 2 & 3: Content bullets ────────────────────────────────
// Large editorial quote-style bullet point
function SlideContent(
  t: Theme,
  type: CarouselType,
  slideNum: 2 | 3,
  point: string,
  title: string,
  lang: "es" | "pt"
) {
  const label = lang === "pt" ? t.labelPt : t.label;
  const pointLabel =
    lang === "pt"
      ? slideNum === 2
        ? "O QUE SABER"
        : "MAIS DETALHES"
      : slideNum === 2
      ? "LO QUE DEBES SABER"
      : "ADEMÁS";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        background: t.bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
      }}
    >
      {/* ── Background texture: faint radial glow ── */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${t.accent}0A 0%, transparent 70%)`,
        }}
      />

      {/* ── Left accent bar ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          backgroundImage: `linear-gradient(to bottom, transparent 5%, ${t.accent} 30%, ${t.accent} 70%, transparent 95%)`,
        }}
      />

      {/* ── Large decorative number ── */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: 120,
          right: 40,
          fontSize: 320,
          fontWeight: 800,
          color: t.accent,
          opacity: 0.05,
          lineHeight: 1,
          letterSpacing: -10,
        }}
      >
        {slideNum}
      </div>

      {/* ── Main layout ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "54px 72px 64px 84px",
          gap: 0,
        }}
      >
        {/* Top row: brand + badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 60,
          }}
        >
          {PeekrBrand(t.accent)}
          {TypeBadge(t.emoji, label, t.accent)}
        </div>

        {/* Section label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: t.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 800,
              color: "#000",
            }}
          >
            {slideNum}
          </div>
          <span
            style={{
              color: t.accent,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            {pointLabel}
          </span>
        </div>

        {/* Title context (smaller, dim) */}
        {title && (
          <div
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.45)",
              fontSize: 26,
              fontWeight: 600,
              marginBottom: 24,
              letterSpacing: 0.5,
            }}
          >
            {title}
          </div>
        )}

        {/* The accent line */}
        {AccentLine(t.accent, 56)}

        {/* Main point text */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            color: "#FFFFFF",
            fontSize: 54,
            fontWeight: 700,
            lineHeight: 1.3,
            marginTop: 32,
            maxWidth: 900,
            flex: 1,
            alignContent: "flex-start",
          }}
        >
          {point ||
            (slideNum === 2
              ? "Detalle clave sobre esta noticia"
              : "Otro punto importante a conocer")}
        </div>

        {/* Bottom row: dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {ProgressDots(slideNum, t.accent)}
        </div>
      </div>
    </div>
  );
}

// ─── Slide 4: CTA ────────────────────────────────────────────────
// Strong call to action — PeekrBuzz link in bio
function Slide4(t: Theme, type: CarouselType, lang: "es" | "pt") {
  const subtext = lang === "pt" ? t.ctaPt : t.ctaEs;
  const cta = lang === "pt" ? "Link na bio 👆" : "Link en la bio 👆";
  const prompt =
    lang === "pt"
      ? "Acesse o PeekrBuzz:"
      : "Entra en PeekrBuzz:";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        background: t.bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ── Background: radial glow centered ── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${t.accent}18 0%, transparent 65%)`,
        }}
      />

      {/* ── Decorative rings ── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 620,
          height: 620,
          borderRadius: "50%",
          border: `1px solid ${t.accent}20`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 820,
          height: 820,
          borderRadius: "50%",
          border: `1px solid ${t.accent}10`,
        }}
      />

      {/* ── Top bar ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "40px 54px",
        }}
      >
        {PeekrBrand(t.accent)}
        {TypeBadge(t.emoji, lang === "pt" ? t.labelPt : t.label, t.accent)}
      </div>

      {/* ── Center content ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          padding: "0 60px",
        }}
      >
        {/* Large P logo */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 30,
            background: `linear-gradient(135deg, ${t.grad1} 0%, ${t.grad2} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 70,
            fontWeight: 800,
            color: "#000",
          }}
        >
          P
        </div>

        {/* PEEKRBUZZ */}
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 82,
            fontWeight: 800,
            letterSpacing: -1,
            textAlign: "center",
          }}
        >
          PEEKRBUZZ
        </div>

        {/* Subtext */}
        <div
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 28,
            fontWeight: 400,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {subtext}
        </div>

        {AccentLine(t.accent, 100)}

        {/* Prompt */}
        <div
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: 2,
            textAlign: "center",
          }}
        >
          {prompt}
        </div>

        {/* CTA pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: t.accent,
            borderRadius: 99,
            padding: "22px 56px",
          }}
        >
          <span
            style={{
              color: "#000",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            {cta}
          </span>
        </div>
      </div>

      {/* ── Bottom: progress dots ── */}
      <div
        style={{
          position: "absolute",
          bottom: 54,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {ProgressDots(4, t.accent)}
      </div>
    </div>
  );
}

// ─── Route handler ────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const p = new URL(request.url).searchParams;

    const rawType = p.get("type") ?? "actualidad";
    const type: CarouselType =
      rawType === "actor" || rawType === "lanzamiento" || rawType === "reco"
        ? rawType
        : "actualidad";

    const slideNum = Math.max(1, Math.min(4, parseInt(p.get("slide") ?? "1")));
    const hook     = (p.get("hook")   ?? "").slice(0, 200);
    const point    = (p.get("point")  ?? "").slice(0, 200);
    const img      = p.get("img")     ?? "";
    const title    = (p.get("title")  ?? "").slice(0, 80);
    const source   = (p.get("source") ?? "").slice(0, 60);
    const rawLang  = p.get("lang")    ?? "es";
    const lang: "es" | "pt" = rawLang === "pt" ? "pt" : "es";

    const t = THEMES[type];
    const fonts = await loadFonts();

    let jsx: ReactElement;

    if (slideNum === 1) {
      jsx = Slide1(t, type, hook, img, source, lang);
    } else if (slideNum === 4) {
      jsx = Slide4(t, type, lang);
    } else {
      jsx = SlideContent(t, type, slideNum as 2 | 3, point, title, lang);
    }

    return new ImageResponse(jsx, {
      width: W,
      height: H,
      fonts,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/slides] render error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
