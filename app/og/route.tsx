// app/api/og/route.tsx
// Genera la imagen Open Graph de la homepage (1200x630) sin deps externas.

import { ImageResponse } from "next/og";

export const runtime = "edge";

const BRAND = "#FA0082";
const BG = "#0B0B0F";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "0 100px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Círculo decorativo fondo */}
        <div
          style={{
            position: "absolute",
            right: "-80px",
            top: "-80px",
            width: "500px",
            height: "500px",
            borderRadius: "999px",
            background: `radial-gradient(circle, ${BRAND}22 0%, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "200px",
            bottom: "-100px",
            width: "360px",
            height: "360px",
            borderRadius: "999px",
            background: `radial-gradient(circle, ${BRAND}15 0%, transparent 70%)`,
          }}
        />

        {/* Pill badge */}
        <div
          style={{
            display: "flex",
            background: `${BRAND}22`,
            border: `1.5px solid ${BRAND}55`,
            borderRadius: "999px",
            padding: "8px 20px",
            marginBottom: "28px",
          }}
        >
          <span style={{ color: BRAND, fontSize: "18px", fontWeight: 700 }}>
            peekr.app
          </span>
        </div>

        {/* Título principal */}
        <div
          style={{
            fontSize: "80px",
            fontWeight: 900,
            color: "white",
            lineHeight: 1.0,
            letterSpacing: "-0.04em",
            marginBottom: "28px",
          }}
        >
          Peekr
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "36px",
            fontWeight: 700,
            color: "rgba(255,255,255,0.82)",
            lineHeight: 1.3,
            letterSpacing: "-0.02em",
            marginBottom: "36px",
            maxWidth: "700px",
          }}
        >
          La red social del cine y las series
        </div>

        {/* Features pills */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {["Social Feed", "PeekLists", "Peekr AI", "SneakPeeks", "Gratis"].map(
            (label) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "999px",
                  padding: "10px 20px",
                  fontSize: "18px",
                  color: "rgba(255,255,255,0.88)",
                  fontWeight: 600,
                  display: "flex",
                }}
              >
                {label}
              </div>
            )
          )}
        </div>

        {/* Línea de color abajo */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "5px",
            background: `linear-gradient(to right, ${BRAND}, transparent)`,
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );
}
