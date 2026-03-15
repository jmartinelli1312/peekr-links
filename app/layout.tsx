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

  const cookieStore = await cookies()
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

        {/* HEADER */}

        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 32px",
            borderBottom: "1px solid #1c1c24",
            background: "#0B0B0F",
          }}
        >

          {/* LEFT */}

          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>

            {/* LOGO */}

            <Link
              href="/"
              style={{
                fontWeight: 800,
                fontSize: 22,
                color: "#FA0082",
                textDecoration: "none",
              }}
            >
              PEEKR
            </Link>

            {/* EXPLORE */}

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

          </div>

          {/* RIGHT */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              fontSize: 14,
            }}
          >

            {/* LANGUAGE */}

            <div style={{ display: "flex", gap: 8 }}>
              <a href="/lang/en">🇺🇸</a>
              <a href="/lang/es">🇪🇸</a>
              <a href="/lang/pt">🇧🇷</a>
            </div>

            {/* SIGN IN */}

            <Link
              href="/login"
              style={{
                textDecoration: "none",
                color: "white",
                opacity: 0.8,
              }}
            >
              Sign in
            </Link>

            {/* CREATE ACCOUNT */}

            <Link
              href="/signup"
              style={{
                background: "#FA0082",
                padding: "8px 14px",
                borderRadius: 6,
                textDecoration: "none",
                color: "white",
                fontWeight: 600,
              }}
            >
              Create account
            </Link>

          </div>

        </header>

        {/* PAGE */}

        <main
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "40px 20px",
          }}
        >
          {children}
        </main>

      </body>
    </html>
  )
}
