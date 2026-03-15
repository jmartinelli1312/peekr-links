
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

  const cookieStore = cookies()
  const lang = cookieStore.get("lang")?.value || "en"

  return (
    <html lang={lang}>
      <body
        style={{
          margin:0,
          background:"#0B0B0F",
          color:"white",
          fontFamily:"-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
        }}
      >

        {/* HEADER /}

        <header
          style={{
            display:"flex",
            justifyContent:"space-between",
            alignItems:"center",
            padding:"14px 28px",
            borderBottom:"1px solid rgba(255,255,255,0.08)",
            position:"sticky",
            top:0,
            background:"#0B0B0F",
            zIndex:1000
          }}
        >

          {/ LEFT NAV /}

          <div style={{display:"flex",alignItems:"center",gap:28}}>

            <Link
              href="/"
              style={{
                fontSize:22,
                fontWeight:800,
                color:"#FA0082",
                textDecoration:"none"
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


          {/ RIGHT NAV /}

          <div style={{display:"flex",alignItems:"center",gap:20}}>

            <div style={{display:"flex",gap:8}}>
              <a href="/lang/en">🇺🇸</a>
              <a href="/lang/es">🇪🇸</a>
              <a href="/lang/pt">🇧🇷</a>
            </div>

            <Link href="/login" style={nav}>
              Sign in
            </Link>

            <Link
              href="/signup"
              style={{
                background:"#FA0082",
                padding:"8px 14px",
                borderRadius:8,
                fontWeight:600,
                color:"white",
                textDecoration:"none"
              }}
            >
              Create account
            </Link>

          </div>

        </header>


        {/ PAGE /}

        <main
          style={{
            maxWidth:1200,
            margin:"0 auto",
            padding:"32px 20px"
          }}
        >
          {children}
        </main>


        {/ FOOTER */}

        <footer
          style={{
            marginTop:80,
            borderTop:"1px solid rgba(255,255,255,0.08)",
            padding:"40px 20px",
            textAlign:"center",
            opacity:0.6,
            fontSize:14
          }}
        >

          <div style={{marginBottom:12}}>
            Peekr © {new Date().getFullYear()}
          </div>

          <div style={{display:"flex",justifyContent:"center",gap:20}}>
            <Link href="/about" style={footerLink}>About</Link>
            <Link href="/privacy" style={footerLink}>Privacy</Link>
            <Link href="/terms" style={footerLink}>Terms</Link>
          </div>

        </footer>

      </body>
    </html>
  )
}


const nav = {
  color:"white",
  textDecoration:"none",
  fontSize:15,
  opacity:0.9
}

const footerLink = {
  color:"white",
  textDecoration:"none",
  opacity
