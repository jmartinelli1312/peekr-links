import "./globals.css";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import SiteHeader from "./components/site-header";

export const metadata = {
  title: "Peekr",
  description: "The social network for movies and series",
};

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "es").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("pt")) return "pt";
  return "es";
}

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    lang: string;
  }>;
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps) {
  const { lang: rawLang } = await params;
  const lang = normalizeLang(rawLang);

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
              <Link href={`/${lang}/about`} className="peekr-footer-link">
                {t.about}
              </Link>
              <Link href={`/${lang}/privacy`} className="peekr-footer-link">
                {t.privacy}
              </Link>
              <Link href={`/${lang}/terms`} className="peekr-footer-link">
                {t.terms}
              </Link>
              <Link href={`/${lang}/contact`} className="peekr-footer-link">
                {t.contact}
              </Link>
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

        <Analytics />
      </body>
    </html>
  );
}
