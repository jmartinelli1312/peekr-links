import "./globals.css"
import Link from "next/link"
import { cookies } from "next/headers"

export const metadata = {
  title: "Peekr",
  description: "The social network for movies and series",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  const cookieStore = await cookies()
  const langCookie = cookieStore.get("lang")?.value

  let lang = "en"

  if (langCookie) {
    lang = langCookie
  }

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

          <div style={{ display: "flex", gap: 28, alignItems: "center" }}>

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

            <Link href="/explore" style={nav}>
              Explore
            </Link>

            <Link href="/lists" style={nav}>
              Lists
            </Link>

            <Link href="/activity" style={nav}>
              Activity
            </Link>

          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>

            <a href="/lang/en">🇺🇸</a>
            <a href="/lang/es">🇪🇸</a>
            <a href="/lang/pt">🇧🇷</a>

            <Link href="/login" style={nav}>
              Sign in
            </Link>

            <Link
              href="/signup"
              style={{
                background: "#FA0082",
                padding: "8px 14px",
                borderRadius: 8,
                fontWeight: 600,
                color: "white",
                textDecoration: "none",
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
            fontSize: 14,
            opacity: 0.7,
          }}
        >

          <div style={{ marginBottom: 18 }}>
            Peekr © {new Date().getFullYear()}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 20,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <Link href="/about" style={footerLink}>About</Link>
            <Link href="/privacy" style={footerLink}>Privacy</Link>
            <Link href="/terms" style={footerLink}>Terms</Link>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <a href="https://instagram.com/peekr.app" target="_blank" style={footerLink}>
              Instagram
            </a>

            <a href="https://x.com/peekr_oficial" target="_blank" style={footerLink}>
              X
            </a>

            <a href="mailto:info@peekr.app" style={footerLink}>
              info@peekr.app
            </a>
          </div>

        </footer>

      </body>
    </html>
  )
}

const nav = {
  color: "white",
  textDecoration: "none",
  fontSize: 15,
  opacity: 0.9,
}

const footerLink = {
  color: "white",
  textDecoration: "none",
  opacity: 0.7,
}
