export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";

const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

export default async function DownloadAppPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      eyebrow: "Peekr",
      title: "Your account is ready.",
      subtitle:
        "The best Peekr experience lives in the app. Download it to rate titles, mark what you watched, build Peeklists and follow activity in real time.",
      appStore: "Download on the App Store",
      googlePlay: "Get it on Google Play",
      continueWeb: "Continue exploring on web",
      note: "You can keep browsing on web, but social actions and tracking are built for the app.",
      iosComingSoon: "Add your real App Store link here",
      androidComingSoon: "Add your real Google Play link here",
    },
    es: {
      eyebrow: "Peekr",
      title: "Tu cuenta está lista.",
      subtitle:
        "La mejor experiencia de Peekr vive en la app. Descárgala para calificar títulos, marcar lo que viste, crear Peeklists y seguir actividad en tiempo real.",
      appStore: "Descargar en App Store",
      googlePlay: "Descargar en Google Play",
      continueWeb: "Seguir explorando en web",
      note: "Puedes seguir navegando en web, pero las acciones sociales y el tracking están pensados para la app.",
      iosComingSoon: "Agrega aquí tu link real de App Store",
      androidComingSoon: "Agrega aquí tu link real de Google Play",
    },
    pt: {
      eyebrow: "Peekr",
      title: "Sua conta está pronta.",
      subtitle:
        "A melhor experiência do Peekr está no app. Baixe para avaliar títulos, marcar o que assistiu, criar Peeklists e seguir atividade em tempo real.",
      appStore: "Baixar na App Store",
      googlePlay: "Baixar no Google Play",
      continueWeb: "Continuar explorando na web",
      note: "Você pode continuar navegando na web, mas as ações sociais e o tracking foram pensados para o app.",
      iosComingSoon: "Adicione aqui seu link real da App Store",
      androidComingSoon: "Adicione aqui seu link real do Google Play",
    },
  }[lang];

  return (
    <>
      <style>{`
        .download-page {
          min-height: calc(100vh - 160px);
          display: grid;
          place-items: center;
        }

        .download-card {
          width: 100%;
          max-width: 860px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 28px;
          padding: 28px 22px;
          text-align: center;
        }

        .download-eyebrow {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(250,0,130,0.12);
          color: ${BRAND};
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 18px;
        }

        .download-card h1 {
          margin: 0;
          font-size: clamp(40px, 9vw, 64px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
        }

        .download-card p {
          margin: 18px auto 0 auto;
          max-width: 700px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .download-actions {
          margin-top: 28px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .btn-primary,
        .btn-secondary,
        .btn-tertiary {
          text-decoration: none;
          border-radius: 18px;
          padding: 16px 18px;
          font-weight: 800;
          font-size: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .btn-primary {
          background: ${BRAND};
          color: white;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.10);
          color: white;
        }

        .btn-tertiary {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.88);
        }

        .download-note {
          margin-top: 20px;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255,255,255,0.56);
        }

        .download-helper {
          margin-top: 18px;
          display: grid;
          gap: 8px;
          text-align: left;
          max-width: 520px;
          margin-left: auto;
          margin-right: auto;
          color: rgba(255,255,255,0.48);
          font-size: 12px;
          line-height: 1.5;
        }

        @media (min-width: 760px) {
          .download-card {
            padding: 34px 34px;
          }

          .download-actions {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>

      <div className="download-page">
        <section className="download-card">
          <div className="download-eyebrow">{t.eyebrow}</div>

          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>

          <div className="download-actions">
            <a
              href="#"
              className="btn-primary"
              aria-label={t.appStore}
            >
              {t.appStore}
            </a>

            <a
              href="#"
              className="btn-secondary"
              aria-label={t.googlePlay}
            >
              {t.googlePlay}
            </a>

            <Link href="/explore" className="btn-tertiary">
              {t.continueWeb}
            </Link>
          </div>

          <div className="download-note">{t.note}</div>

          <div className="download-helper">
            <div>iOS: {t.iosComingSoon}</div>
            <div>Android: {t.androidComingSoon}</div>
          </div>
        </section>
      </div>
    </>
  );
}
