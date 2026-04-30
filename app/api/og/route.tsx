// app/api/og/route.tsx
// Genera la imagen Open Graph de la homepage (1200x630).
// Usada por Twitter/X, Facebook, WhatsApp, iMessage, etc.
// URL: /api/og  — apuntada desde generateMetadata de [lang]/page.tsx

import { ImageResponse } from "next/og";

export const runtime = "edge";

const SITE = "https://www.peekr.app";
const BRAND = "#FA0082";
const BG = "#0B0B0F";

export async function GET() {
  const logoUrl = `${SITE}/assets/logo-text.png`;
  const iconUrl = `${SITE}/assets/logo-icon.png`;

  // Posters decorativos — títulos populares de TMDB (fijos, no llaman API)
  const posters = [
    "https://image.tmdb.org/t/p/w342/9cqNxx0GxF0bAY5gFxZCdMkKOgU.jpg", // Breaking Bad
    "https://image.tmdb.org/t/p/w342/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg", // Stranger Things
    "https://image.tmdb.org/t/p/w342/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", // The Bear
    "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", // Succession
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: BG,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "60px 72px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, Helvetica, sans-serif",
        }}
      >
        {/* Gradient overlay derecho */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "520px",
            height: "630px",
            background: `linear-gradient(to left, ${BG} 0%, transparent 100%)`,
            zIndex: 2,
          }}
        />

        {/* Columna izquierda — texto */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            zIndex: 3,
            maxWidth: "560px",
          }}
        >
          {/* Logo icon + nombre */}
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={iconUrl}
              width={72}
              height={72}
              alt="Peekr"
              style={{ borderRadius: "18px" }}
            />
            <span
              style={{
                fontSize: "52px",
                fontWeight: 900,
                color: "white",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              Peekr
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "rgba(255,255,255,0.92)",
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
            }}
          >
            La red social del cine
            <br />y las series
          </div>

          {/* Descripción corta */}
          <div
            style={{
              fontSize: "20px",
              color: "rgba(255,255,255,0.62)",
              lineHeight: 1.5,
              fontWeight: 400,
            }}
          >
            Descubrí, calificá y comentá con tus amigos.
            <br />
            Gratis en iOS y Android.
          </div>

          {/* Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                background: BRAND,
                borderRadius: "999px",
                padding: "10px 20px",
                fontSize: "16px",
                fontWeight: 800,
                color: "white",
              }}
            >
              peekr.app
            </div>
          </div>
        </div>

        {/* Columna derecha — collage de posters */}
        <div
          style={{
            display: "flex",
            gap: "14px",
            alignItems: "center",
            zIndex: 1,
            transform: "rotate(4deg)",
            marginRight: "-20px",
          }}
        >
          {/* Columna 1 — 2 posters */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "40px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posters[0]}
              width={130}
              height={195}
              alt=""
              style={{ borderRadius: "14px", opacity: 0.9 }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posters[1]}
              width={130}
              height={195}
              alt=""
              style={{ borderRadius: "14px", opacity: 0.75 }}
            />
          </div>
          {/* Columna 2 — 2 posters offset */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "-40px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posters[2]}
              width={130}
              height={195}
              alt=""
              style={{ borderRadius: "14px", opacity: 0.85 }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posters[3]}
              width={130}
              height={195}
              alt=""
              style={{ borderRadius: "14px", opacity: 0.65 }}
            />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
