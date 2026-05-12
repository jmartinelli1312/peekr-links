/**
 * /api/buzz-carousel-slide — Cinematic 1080×1350 IG/FB slide renderer.
 *
 * Three layouts:
 *   - kind=hook    → full-bleed image, dark gradient, massive uppercase
 *                    headline center-bottom, category chip top-left,
 *                    PEEKR mark top-right, progress dots bottom.
 *   - kind=body    → full-bleed image, gradient, headline + 1-line body
 *                    bottom-aligned, category chip top-left.
 *   - kind=thesis  → dark gradient (palette-driven), large italic thesis
 *                    center, CTA below in lighter weight, PEEKR mark bottom.
 *
 * Query params:
 *   kind           : 'hook' | 'body' | 'thesis'
 *   n              : 1..10  (current slide number)
 *   total          : default 10 (for progress dots)
 *   headline       : string (always)
 *   body           : optional string (body + thesis slides)
 *   img            : optional background image URL
 *   category       : 'MOVIE STORY' (chip text)
 *   emoji          : '🎬' (chip emoji)
 *   palette_p      : '#RRGGBB' primary
 *   palette_s      : '#RRGGBB' secondary
 *   palette_a      : '#RRGGBB' accent
 *   palette_bg     : '#RRGGBB' deep bg fallback
 */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type { ReactElement } from "react";

export const runtime = "edge";

const W = 1080;
const H = 1350;
const LOGO_URL = "https://www.peekr.app/assets/logo-icon.png";

// ─── Font loading (cached per warm edge instance) ────────────────────────────
// Inter for the body, Anton-ish condensed via Bebas for headlines. Satori
// supports TTF/WOFF only — pick the @fontsource v4 line which still ships .woff.
let _inter400: ArrayBuffer | null = null;
let _inter700: ArrayBuffer | null = null;
let _inter800: ArrayBuffer | null = null;
let _bebas400: ArrayBuffer | null = null;

async function loadFonts() {
  if (!_inter400 || !_inter700 || !_inter800 || !_bebas400) {
    const interBase = "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files";
    const bebasBase = "https://cdn.jsdelivr.net/npm/@fontsource/bebas-neue@4.5.9/files";
    const results = await Promise.allSettled([
      fetch(`${interBase}/inter-latin-400-normal.woff`).then((r) => r.arrayBuffer()),
      fetch(`${interBase}/inter-latin-700-normal.woff`).then((r) => r.arrayBuffer()),
      fetch(`${interBase}/inter-latin-800-normal.woff`).then((r) => r.arrayBuffer()),
      fetch(`${bebasBase}/bebas-neue-latin-400-normal.woff`).then((r) => r.arrayBuffer()),
    ]);
    _inter400 = results[0].status === "fulfilled" ? results[0].value : null;
    _inter700 = results[1].status === "fulfilled" ? results[1].value : null;
    _inter800 = results[2].status === "fulfilled" ? results[2].value : null;
    _bebas400 = results[3].status === "fulfilled" ? results[3].value : null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fonts: any[] = [];
  if (_inter400) fonts.push({ name: "Inter", data: _inter400, weight: 400, style: "normal" });
  if (_inter700) fonts.push({ name: "Inter", data: _inter700, weight: 700, style: "normal" });
  if (_inter800) fonts.push({ name: "Inter", data: _inter800, weight: 800, style: "normal" });
  if (_bebas400) fonts.push({ name: "Bebas Neue", data: _bebas400, weight: 400, style: "normal" });
  return fonts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hex(v: string | null | undefined, fallback: string): string {
  if (!v) return fallback;
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) return v.startsWith("#") ? v : `#${v}`;
  return fallback;
}

function ProgressDots(slide: number, total: number, accent: string) {
  const arr: number[] = [];
  for (let i = 1; i <= total; i++) arr.push(i);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {arr.map((i) => (
        <div
          key={i}
          style={{
            width: i === slide ? 24 : 8,
            height: 6,
            borderRadius: 99,
            background: i === slide ? accent : "rgba(255,255,255,0.28)",
          }}
        />
      ))}
    </div>
  );
}

function CategoryChip(category: string, emoji: string, accent: string) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 18px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        border: `1.5px solid ${accent}`,
      }}
    >
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span
        style={{
          color: "white",
          fontFamily: "Inter",
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: 2,
        }}
      >
        {category}
      </span>
    </div>
  );
}

function PeekrMark(size: "lg" | "sm" = "lg") {
  const px = size === "lg" ? 36 : 28;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_URL}
        width={px}
        height={px}
        style={{ borderRadius: 8 }}
      />
      <span
        style={{
          color: "white",
          fontFamily: "Inter",
          fontWeight: 800,
          fontSize: size === "lg" ? 22 : 18,
          letterSpacing: 1,
        }}
      >
        PEEKR
      </span>
    </div>
  );
}

// ─── Slide layouts ────────────────────────────────────────────────────────────

interface SlideParams {
  kind: "hook" | "body" | "thesis";
  n: number;
  total: number;
  headline: string;
  body: string | null;
  img: string | null;
  category: string;
  emoji: string;
  palette: { p: string; s: string; a: string; bg: string };
}

function HookSlide(p: SlideParams): ReactElement {
  return (
    <div
      style={{
        width: W, height: H,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: p.palette.bg,
        position: "relative",
      }}
    >
      {/* Background image (full-bleed) */}
      {p.img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.img}
          width={W} height={H}
          style={{
            position: "absolute", top: 0, left: 0,
            width: W, height: H, objectFit: "cover",
          }}
        />
      ) : null}

      {/* Top gradient (so chip + mark stay legible) */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, width: W, height: 280,
          background: "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
          display: "flex",
        }}
      />

      {/* Bottom heavy gradient */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, width: W, height: 900,
          background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 55%, ${p.palette.bg} 100%)`,
          display: "flex",
        }}
      />

      {/* Top row: category chip + Peekr mark */}
      <div
        style={{
          position: "relative", zIndex: 2,
          padding: "44px 52px 0 52px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        {CategoryChip(p.category, p.emoji, p.palette.p)}
        {PeekrMark("lg")}
      </div>

      {/* Hook text — Bebas, MAYÚSCULAS, gigantesco */}
      <div
        style={{
          position: "relative", zIndex: 2,
          padding: "0 60px 80px 60px",
          display: "flex", flexDirection: "column", gap: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "white",
            fontFamily: "Bebas Neue",
            fontWeight: 400,
            fontSize: 112,
            lineHeight: 1.02,
            letterSpacing: 1,
            textTransform: "uppercase",
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          {p.headline}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {ProgressDots(p.n, p.total, p.palette.p)}
          <div
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.55)",
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: 2,
            }}
          >
            DESLIZÁ →
          </div>
        </div>
      </div>
    </div>
  );
}

function BodySlide(p: SlideParams): ReactElement {
  return (
    <div
      style={{
        width: W, height: H,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: p.palette.bg,
        position: "relative",
      }}
    >
      {p.img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.img}
          width={W} height={H}
          style={{
            position: "absolute", top: 0, left: 0,
            width: W, height: H, objectFit: "cover",
          }}
        />
      ) : null}

      {/* Top gradient */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, width: W, height: 220,
          background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
          display: "flex",
        }}
      />
      {/* Bottom heavy gradient */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, width: W, height: 760,
          background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 50%, ${p.palette.bg} 100%)`,
          display: "flex",
        }}
      />

      <div
        style={{
          position: "relative", zIndex: 2,
          padding: "44px 52px 0 52px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        {CategoryChip(p.category, p.emoji, p.palette.p)}
        {PeekrMark("sm")}
      </div>

      <div
        style={{
          position: "relative", zIndex: 2,
          padding: "0 60px 76px 60px",
          display: "flex", flexDirection: "column", gap: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "white",
            fontFamily: "Bebas Neue",
            fontWeight: 400,
            fontSize: 72,
            lineHeight: 1.02,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          {p.headline}
        </div>
        {p.body ? (
          <div
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "Inter",
              fontWeight: 400,
              fontSize: 30,
              lineHeight: 1.35,
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            {p.body}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          {ProgressDots(p.n, p.total, p.palette.p)}
          <div
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.45)",
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: 2,
            }}
          >
            {p.n} / {p.total}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThesisSlide(p: SlideParams): ReactElement {
  // The closing slide is image-light but high-contrast — palette-driven gradient
  // with a faint backdrop overlay if an image is provided.
  return (
    <div
      style={{
        width: W, height: H,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: `linear-gradient(160deg, ${p.palette.bg} 0%, ${p.palette.s} 100%)`,
        position: "relative",
      }}
    >
      {/* Faint backdrop overlay if provided */}
      {p.img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.img}
          width={W} height={H}
          style={{
            position: "absolute", top: 0, left: 0,
            width: W, height: H, objectFit: "cover",
            opacity: 0.22,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at 50% 40%, rgba(0,0,0,0) 0%, ${p.palette.bg} 80%)`,
          display: "flex",
        }}
      />

      <div
        style={{
          position: "relative", zIndex: 2,
          padding: "44px 52px 0 52px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        {CategoryChip(p.category, p.emoji, p.palette.p)}
        {PeekrMark("sm")}
      </div>

      {/* Center: thesis + cta */}
      <div
        style={{
          position: "relative", zIndex: 2,
          padding: "0 70px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 40,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "white",
            fontFamily: "Bebas Neue",
            fontWeight: 400,
            fontSize: 84,
            lineHeight: 1.05,
            letterSpacing: 1,
            textAlign: "center",
            textTransform: "uppercase",
            textShadow: "0 4px 24px rgba(0,0,0,0.55)",
          }}
        >
          {p.headline}
        </div>

        {/* divider */}
        <div
          style={{
            width: 120, height: 3, borderRadius: 99,
            background: p.palette.a,
            display: "flex",
          }}
        />

        {p.body ? (
          <div
            style={{
              display: "flex",
              color: "white",
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: 32,
              lineHeight: 1.4,
              textAlign: "center",
            }}
          >
            {p.body}
          </div>
        ) : null}
      </div>

      {/* Bottom: Peekr mark + dots */}
      <div
        style={{
          position: "relative", zIndex: 2,
          padding: "0 60px 60px 60px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        {ProgressDots(p.n, p.total, p.palette.p)}
        <div
          style={{
            display: "flex",
            color: "rgba(255,255,255,0.55)",
            fontFamily: "Inter",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: 2,
          }}
        >
          @PEEKR.APP
        </div>
      </div>
    </div>
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const params: SlideParams = {
    kind: ((sp.get("kind") ?? "body") as SlideParams["kind"]),
    n: Math.max(1, Math.min(10, parseInt(sp.get("n") ?? "1", 10) || 1)),
    total: Math.max(2, Math.min(10, parseInt(sp.get("total") ?? "10", 10) || 10)),
    headline: (sp.get("headline") ?? "").slice(0, 200),
    body: sp.get("body") ? sp.get("body")!.slice(0, 280) : null,
    img: sp.get("img"),
    category: (sp.get("category") ?? "PEEKRBUZZ").slice(0, 28),
    emoji: (sp.get("emoji") ?? "🎬").slice(0, 4),
    palette: {
      p:  hex(sp.get("palette_p"),  "#FA0082"),
      s:  hex(sp.get("palette_s"),  "#6B0035"),
      a:  hex(sp.get("palette_a"),  "#FFC8E2"),
      bg: hex(sp.get("palette_bg"), "#0B0610"),
    },
  };

  const fonts = await loadFonts();

  let tree: ReactElement;
  if (params.kind === "hook")        tree = HookSlide(params);
  else if (params.kind === "thesis") tree = ThesisSlide(params);
  else                                tree = BodySlide(params);

  return new ImageResponse(tree, {
    width: W,
    height: H,
    fonts,
    headers: {
      // Long cache: slides are deterministic given the query string.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
