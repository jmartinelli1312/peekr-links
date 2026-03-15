import "./globals.css"
import Link from "next/link"
import { cookies } from "next/headers"

export const metadata = {
  title: "Peekr",
  description: "The social network for movies and series",
}

export default function RootLayout({
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
          margin: 0,
          background: "#0B0B0F",
          color: "white",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
        }}
      >

        {/* HEADER */}

        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 28px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            position: "sticky",
            top: 0,
            background: "#0B0B0F",
            zIndex: 1000,
          }}
        >

          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>

            <Link
              href="/"
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#FA0082",
                textDecoration: "none",
              }}
            >
              Peekr
            </Link>

            <Link href="/explore" style={{ color: "white", textDecoration: "none" }}>
              Explore
            </Link>

            <Link href="/lists" style={{ color: "white", textDecoration: "none" }}>
              Lists
            </Link>

            <Link href="/activity" style={{ color: "white", textDecoration: "none" }}>
              Activity
            </Link>

          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>

            <a href="/lang/en">🇺🇸</a>
            <a href="/lang/es">🇪🇸</a>
            <a href="/lang/pt">🇧🇷</a>

            <Link href="/login" style={{ color: "white", textDecoration: "none" }}>
              Sign in
            </Link>

            <Link
              href="/signup"
              style={{
                background: "#FA0082",
                padding: "8px 14px",
                borderRadius: 8,
                color: "white",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Create account
            </Link>

          </div>

        </header>

        <main
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "32px 20px",
          }}
        >
          {children}
        </main>

        <footer
          style={{
            marginTop: 80,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "40px 20px",
            textAlign: "center",
            opacity: 0.7,
            fontSize: 14,
          }}
        >
          Peekr © {new Date().getFullYear()}
        </footer>

      </body>
    </html>
  )
