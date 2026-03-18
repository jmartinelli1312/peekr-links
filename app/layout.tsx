import "./globals.css";
import { cookies } from "next/headers";
import SiteHeader from "./components/site-header";

export const metadata = {
  title: "Peekr",
  description: "The social network for movies and series",
};

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      about: "About",
      privacy: "Privacy",
      terms: "Terms",
      contact: "Contact",
      ownedBy: "Owned and operated by Emanation Films, Inc.",
    },
    es: {
      about: "Acerca de",
      privacy: "Privacidad",
      terms: "Términos",
      contact: "Contacto",
      ownedBy: "Propiedad y operación de Emanation Films, Inc.",
    },
    pt: {
      about: "Sobre",
      privacy: "Privacidade",
      terms: "Termos",
      contact: "Contato",
      ownedBy: "De propriedade e operado por Emanation Films, Inc.",
    },
  }[lang];

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
            opacity: 0.88;
          }

          .peekr-footer-inner {
            max-width: 1200px;
            margin: 0 auto;
          }

          .peekr-footer-top {
            margin-bottom: 12px;
            font-weight: 700;
            color: rgba(255,255,255,0.92);
          }

          .peekr-footer-owned {
            margin-bottom: 18px;
            color: rgba(255,255,255,0.72);
            line-height: 1.6;
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
            text-decoration: none;
            opacity: 0.78;
          }

          .peekr-footer-link:hover {
            opacity: 1;
          }
        `}</style>

        <SiteHeader lang={lang} />

        <main className="peekr-main">{children}</main>

        <footer className="peekr-footer">
          <div className="peekr-footer-inner">
            <div className="peekr-footer-top">
              Peekr © {new Date().getFullYear()}
            </div>

            <div className="peekr-footer-owned">{t.ownedBy}</div>

            <div className="peekr-footer-links">
              <a href="/about" className="peekr-footer-link">
                {t.about}
              </a>
              <a href="/privacy" className="peekr-footer-link">
                {t.privacy}
              </a>
              <a href="/terms" className="peekr-footer-link">
                {t.terms}
              </a>
              <a href="/contact" className="peekr-footer-link">
                {t.contact}
              </a>
            </div>

            <div className="peekr-footer-social">
              <a
                href="https://instagram.com/peekr.app"
                target="_blank"
                rel="noreferrer"
                className="peekr-footer-link"
              >
                Instagram
              </a>
              <a
                href="https://x.com/peekr_oficial"
                target="_blank"
                rel="noreferrer"
                className="peekr-footer-link"
              >
                X
              </a>
              <a href="mailto:info@peekr.app" className="peekr-footer-link">
                info@peekr.app
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
