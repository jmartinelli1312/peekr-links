import "./globals.css"
import Link from "next/link"
import { cookies } from "next/headers"

export const metadata = {
  title: "Peekr",
  description: "Movies • Series • Watchlists",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  const cookieStore = cookies()
  const lang = cookieStore.get("lang")?.value || "en"

  return (
    <html lang={lang}>
      <body
        style={{
          background: "#0B0B0F",
          color: "white",
          margin: 0,
          fontFamily:
            "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
        }}
      >

        {/* HEADER /}

        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            position: "sticky",
            top: 0,
            background: "#0B0B0F",
            zIndex: 1000,
          }}
        >

          {/ LEFT /}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
            }}
          >

            {/ LOGO /}

            <Link
              href="/"
              style={{
                fontWeight: 800,
                fontSize: 20,
                color: "#FA0082",
                textDecoration: "none",
              }}
            >
              Peekr
            </Link>

            {/ NAV /}

            <Link
              href="/explore"
              style={{
                color: "white",
                textDecoration: "none",
                fontSize: 15,
                opacity: 0.9,
              }}
            >
              Explore
            </Link>

            <Link
              href="/lists"
              style={{
                color: "white",
                textDecoration: "none",
                fontSize: 15,
                opacity: 0.9,
              }}
            >
              Lists
            </Link>

            <Link
              href="/activity"
              style={{
                color: "white",
                textDecoration: "none",
                fontSize: 15,
                opacity: 0.9,
              }}
            >
              Activity
            </Link>

          </div>

          {/ RIGHT /}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontSize: 14,
            }}
          >

            {/ LANGUAGE /}

            <div style={{display:"flex",gap:8}}>
              <a href="/lang/en">🇺🇸</a>
              <a href="/lang/es">🇪🇸</a>
              <a href="/lang/pt">🇧🇷</a>
            </div>

            {/ AUTH /}

            <Link
              href="/login"
              style={{
                color: "white",
                textDecoration: "none",
                opacity: 0.9,
              }}
            >
              Sign in
            </Link>

            <Link
              href="/signup"
              style={{
                background: "#FA0082",
                padding: "8px 14px",
                borderRadius: 8,
                color: "white",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Create account
            </Link>

          </div>

        </header>

        {/ PAGE */}

        <main
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "32px 20px",
          }}
        >
          {children}
        </main>

      </body>
    </html>
  )
