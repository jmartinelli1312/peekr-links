import "./globals.css"
import Link from "next/link"
import { cookies } from "next/headers"

export const metadata = {
  title: "Peekr",
  description: "The social network for movies and series",
}

type Lang = "en" | "es" | "pt"

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase()
  if (raw.startsWith("es")) return "es"
  if (raw.startsWith("pt")) return "pt"
  return "en"
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const lang = normalizeLang(cookieStore.get("lang")?.value)

  const t = {
    en: {
      explore: "Explore",
      lists: "Lists",
      activity: "Activity",
      signIn: "Sign in",
      createAccount: "Create account",
      about: "About",
      privacy: "Privacy",
      terms: "Terms",
    },
    es: {
      explore: "Explorar",
      lists: "Listas",
      activity: "Actividad",
      signIn: "Iniciar sesión",
      createAccount: "Crear cuenta",
      about: "Acerca de",
      privacy: "Privacidad",
      terms: "Términos",
    },
    pt: {
      explore: "Explorar",
      lists: "Listas",
      activity: "Atividade",
      signIn: "Entrar",
      createAccount: "Criar conta",
      about: "Sobre",
      privacy: "Privacidade",
      terms: "Termos",
    },
  }[lang]

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
        <style>{`
          .peekr-header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background: #0B0B0F;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }

          .peekr-header-inner {
            max-width: 1200px;
            margin: 0 auto;
            padding: 14px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .peekr-logo {
            font-size: 22px;
            font-weight: 800;
            color: #FA0082;
            text-decoration: none;
            flex-shrink: 0;
          }

          .peekr-nav-desktop {
            display: none;
            align-items: center;
            gap: 28px;
          }

          .peekr-actions-desktop {
            display: none;
            align-items: center;
            gap: 16px;
          }

          .peekr-link {
            color: white;
            text-decoration: none;
            font-size: 15px;
            opacity: 0.9;
          }

          .peekr-signup {
            background: #FA0082;
            padding: 10px 14px;
            border-radius: 10px;
            font-weight: 700;
            color: white;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .peekr-lang {
            position: relative;
          }

          .peekr-lang summary,
          .peekr-menu summary {
            list-style: none;
            cursor: pointer;
          }

          .peekr-lang summary::-webkit-details-marker,
          .peekr-menu summary::-webkit-details-marker {
            display: none;
          }

          .peekr-lang-menu {
            position: absolute;
            right: 0;
            top: 34px;
            min-width: 150px;
            background: #111;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 16px 40px rgba(0,0,0,0.35);
          }

          .peekr-lang-item {
            display: block;
            padding: 10px 12px;
            text-decoration: none;
            color: white;
            font-size: 14px;
          }

          .peekr-lang-item:hover {
            background: rgba(255,255,255,0.06);
          }

          .peekr-mobile-right {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-left: auto;
          }

          .peekr-menu {
            position: relative;
          }

          .peekr-menu-button {
            width: 42px;
            height: 42px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.04);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .peekr-menu-icon {
            width: 18px;
            height: 12px;
            position: relative;
            display: block;
          }

          .peekr-menu-icon::before,
          .peekr-menu-icon::after,
          .peekr-menu-icon span {
            content: "";
            position: absolute;
            left: 0;
            width: 18px;
            height: 2px;
            background: white;
            border-radius: 999px;
          }

          .peekr-menu-icon::before {
            top: 0;
          }

          .peekr-menu-icon span {
            top: 5px;
          }

          .peekr-menu-icon::after {
            top: 10px;
          }

          .peekr-mobile-panel {
            position: absolute;
            right: 0;
            top: 50px;
            width: min(280px, calc(100vw - 32px));
            background: #111;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 14px;
            padding: 10px;
            box-shadow: 0 18px 44px rgba(0,0,0,0.38);
          }

          .peekr-mobile-item {
            display: block;
            padding: 12px 10px;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-size: 15px;
          }

          .peekr-mobile-item:hover {
            background: rgba(255,255,255,0.06);
          }

          .peekr-mobile-divider {
            height: 1px;
            background: rgba(255,255,255,0.08);
            margin: 8px 0;
          }

          .peekr-main {
            max-width: 1200px;
            margin: 0 auto;
            padding: 32px 20px;
          }

          .peekr-footer {
            margin-top: 80px;
            border-top: 1px solid rgba(255,255,255,0.08);
            padding: 40px 20px;
            text-align: center;
            font-size: 14px;
            opacity: 0.7;
          }

          .peekr-footer-inner {
            max-width: 1200px;
            margin: 0 auto;
          }

          .peekr-footer-links,
          .peekr-footer-social {
            display: flex;
            justify-content: center;
            gap: 16px;
            flex-wrap: wrap;
          }

          .peekr-footer-links {
            margin: 0 0 18px 0;
          }

          .peekr-footer-link {
            color: white;
            textDecoration: none;
            opacity: 0.7;
          }

          @media (min-width: 900px) {
            .peekr-header-inner {
              padding: 14px 28px;
            }

            .peekr-nav-desktop {
              display: flex;
            }

            .peekr-actions-desktop {
              display: flex;
            }

            .peekr-mobile-right {
              display: none;
            }

            .peekr-main {
              padding: 32px 20px;
            }
          }
        `}</style>

        <header className="peekr-header">
          <div className="peekr-header-inner">
            <Link href="/" className="peekr-logo">
              Peekr
            </Link>

            <nav className="peekr-nav-desktop">
              <Link href="/explore" className="peekr-link">
                {t.explore}
              </Link>
              <Link href="/lists" className="peekr-link">
                {t.lists}
              </Link>
              <Link href="/activity" className="peekr-link">
                {t.activity}
              </Link>
            </nav>

            <div className="peekr-actions-desktop">
              <details className="peekr-lang">
                <summary style={{ cursor: "pointer", fontSize: 18 }}>🌍</summary>
                <div className="peekr-lang-menu">
                  <a href="/lang/en" className="peekr-lang-item">🇺🇸 English</a>
                  <a href="/lang/es" className="peekr-lang-item">🇪🇸 Español</a>
                  <a href="/lang/pt" className="peekr-lang-item">🇧🇷 Português</a>
                </div>
              </details>

              <Link href="/login" className="peekr-link">
                {t.signIn}
              </Link>

              <Link href="/signup" className="peekr-signup">
                {t.createAccount}
              </Link>
            </div>

            <div className="peekr-mobile-right">
              <details className="peekr-lang">
                <summary style={{ cursor: "pointer", fontSize: 18 }}>🌍</summary>
                <div className="peekr-lang-menu">
                  <a href="/lang/en" className="peekr-lang-item">🇺🇸 English</a>
                  <a href="/lang/es" className="peekr-lang-item">🇪🇸 Español</a>
                  <a href="/lang/pt" className="peekr-lang-item">🇧🇷 Português</a>
                </div>
              </details>

              <details className="peekr-menu">
                <summary className="peekr-menu-button">
                  <span className="peekr-menu-icon">
                    <span />
                  </span>
                </summary>

                <div className="peekr-mobile-panel">
                  <Link href="/explore" className="peekr-mobile-item">
                    {t.explore}
                  </Link>
                  <Link href="/lists" className="peekr-mobile-item">
                    {t.lists}
                  </Link>
                  <Link href="/activity" className="peekr-mobile-item">
                    {t.activity}
                  </Link>

                  <div className="peekr-mobile-divider" />

                  <Link href="/login" className="peekr-mobile-item">
                    {t.signIn}
                  </Link>
                  <Link href="/signup" className="peekr-mobile-item">
                    {t.createAccount}
                  </Link>
                </div>
              </details>
            </div>
          </div>
        </header>

        <main className="peekr-main">{children}</main>

        <footer className="peekr-footer">
          <div className="peekr-footer-inner">
            <div style={{ marginBottom: 18 }}>
              Peekr © {new Date().getFullYear()}
            </div>

            <div className="peekr-footer-links">
              <Link href="/about" className="peekr-footer-link">{t.about}</Link>
              <Link href="/privacy" className="peekr-footer-link">{t.privacy}</Link>
              <Link href="/terms" className="peekr-footer-link">{t.terms}</Link>
            </div>

            <div className="peekr-footer-social">
              <a
                href="https://instagram.com/peekr.app"
                target="_blank"
                className="peekr-footer-link"
              >
                Instagram
              </a>
              <a
                href="https://x.com/peekr_oficial"
                target="_blank"
                className="peekr-footer-link"
              >
                X
              </a>
              <a
                href="mailto:info@peekr.app"
                className="peekr-footer-link"
              >
                info@peekr.app
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
