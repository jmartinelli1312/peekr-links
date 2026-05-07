import SiteHeader from "../components/site-header";
import AppDownloadBanner from "@/components/AppDownloadBanner";

type Lang = "en" | "es" | "pt";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    lang: string;
  }>;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "es").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("pt")) return "pt";
  return "es";
}

const OG_LOCALE: Record<Lang, string> = {
  es: "es_ES",
  en: "en_US",
  pt: "pt_BR",
};

// Sets og:locale per language so Google and social crawlers see the correct
// locale even though <html lang> is fixed to "es" in the root layout.
// Child page metadata overrides this when it sets its own openGraph block,
// but any page that omits og:locale inherits the correct value here.
export async function generateMetadata({
  params,
}: Pick<LayoutProps, "params">) {
  const { lang: rawLang } = await params;
  const lang = normalizeLang(rawLang);

  return {
    openGraph: {
      locale: OG_LOCALE[lang],
    },
  };
}

export default async function LangLayout({
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
    <>
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
      <AppDownloadBanner lang={lang} />

      <main className="peekr-main">{children}</main>

      <footer className="peekr-footer">
        <div className="peekr-footer-inner">
          <div className="peekr-footer-top">
            Peekr © {new Date().getFullYear()}
          </div>

          <div className="peekr-footer-owned">{t.ownedBy}</div>

          <div className="peekr-footer-links">
            <a href={`/${lang}/about`} className="peekr-footer-link">
              {t.about}
            </a>
            <a href={`/${lang}/privacy`} className="peekr-footer-link">
              {t.privacy}
            </a>
            <a href={`/${lang}/terms`} className="peekr-footer-link">
              {t.terms}
            </a>
            <a href={`/${lang}/contact`} className="peekr-footer-link">
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

    </>
  );
}
