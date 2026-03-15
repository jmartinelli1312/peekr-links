import "./globals.css"
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

        {/* LANGUAGE SWITCH */}

        <div
          style={{
            position: "fixed",
            top: 15,
            right: 20,
            zIndex: 9999,
            display: "flex",
            gap: 10,
            fontSize: 14,
          }}
        >
          <a href="/lang/en">🇺🇸 EN</a>
          <a href="/lang/es">🇪🇸 ES</a>
          <a href="/lang/pt">🇧🇷 PT</a>
        </div>

        {children}

      </body>
    </html>
  )
}
