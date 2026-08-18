// app/og/quiz/route.tsx
// Branded 1080x1350 (4:5) cover for the Cinema IQ quiz — doubles as the IG feed
// post image and the link-unfurl OG image. Open /og/quiz and save the PNG.
// NOTE: next/og (satori) requires every element with >1 child to be a flex
// container, and forbids mixing text with inline <span>/<br/>. So each text
// line is its own single-child <div>.

import { ImageResponse } from "next/og";

export const runtime = "edge";

const BRAND = "#FA0082";
const BG = "#0B0B0F";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1350px",
          background: BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "90px 80px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
          textAlign: "center",
        }}
      >
        {/* Magenta glows */}
        <div
          style={{
            position: "absolute",
            top: "-160px",
            right: "-160px",
            width: "620px",
            height: "620px",
            borderRadius: "999px",
            background: `radial-gradient(circle, ${BRAND}33 0%, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-180px",
            left: "-160px",
            width: "560px",
            height: "560px",
            borderRadius: "999px",
            background: `radial-gradient(circle, ${BRAND}22 0%, transparent 70%)`,
          }}
        />

        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 900, color: BRAND, letterSpacing: 2 }}>
            PEEKR
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 6, marginTop: 8 }}>
            CINEMA IQ TEST
          </div>
        </div>

        {/* Hook */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 900, color: "#FFFFFF", lineHeight: 1.06 }}>
            ¿Qué tan alto es tu
          </div>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 900, color: BRAND, lineHeight: 1.05, marginTop: 4 }}>
            Cinema IQ?
          </div>
          <div style={{ display: "flex", fontSize: 72, marginTop: 46, letterSpacing: 6 }}>
            🎬 🍿 🧠 💎 🕰️ 🔥
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 46 }}>
            <div style={{ display: "flex", fontSize: 42, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>
              Menos del 1% llega al nivel máximo.
            </div>
            <div style={{ display: "flex", fontSize: 42, fontWeight: 700, color: "rgba(255,255,255,0.82)", marginTop: 10 }}>
              Descubre tu arquetipo de espectador.
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              backgroundColor: BRAND,
              color: "#FFFFFF",
              fontSize: 44,
              fontWeight: 800,
              padding: "26px 54px",
              borderRadius: "999px",
            }}
          >
            Haz el test → peekr.app/quiz
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: BRAND, marginTop: 30 }}>
            @peekr.oficial
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350 },
  );
}
