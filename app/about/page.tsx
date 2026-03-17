export const dynamic = "force-dynamic";

import { cookies } from "next/headers";

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

export async function generateMetadata() {
  return {
    title: "About Peekr",
    description:
      "Peekr is owned and operated by Emanation Films, Inc. Learn more about the company, the platform, and how to contact support.",
    alternates: {
      canonical: "https://www.peekr.app/about",
    },
    openGraph: {
      title: "About Peekr",
      description:
        "Peekr is owned and operated by Emanation Films, Inc.",
      url: "https://www.peekr.app/about",
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "About Peekr",
      description:
        "Peekr is owned and operated by Emanation Films, Inc.",
    },
  };
}

export default async function AboutPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      eyebrow: "About Peekr",
      title: "Peekr is owned and operated by Emanation Films, Inc.",
      intro:
        "Peekr is a social platform for movies and series where users can track what they watch, rate titles, discover actors and creators, and share taste through social activity and curated lists.",
      companyTitle: "Company",
      companyBody1:
        "Peekr is owned and operated by Emanation Films, Inc., the company responsible for the development, operation, support, and public distribution of the Peekr platform and related services.",
      companyBody2:
        "Emanation Films, Inc. manages Peekr’s website, app presence, support channels, and platform communications.",
      missionTitle: "What Peekr does",
      missionBody:
        "Peekr helps people discover movies and series through ratings, comments, watch activity, editorial collections, and social discovery features. The platform is designed to make entertainment discovery more social, personal, and interactive.",
      supportTitle: "Support",
      supportBody:
        "For support, customer service, technical issues, privacy requests, or business inquiries, please contact us through our public contact page or by email.",
      supportCta: "Contact support",
      legalTitle: "Legal and policy links",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      contact: "Contact",
      detailsTitle: "Company details",
      detailsNameLabel: "Legal entity",
      detailsNameValue: "Emanation Films, Inc.",
      detailsProductLabel: "Product",
      detailsProductValue: "Peekr",
      detailsEmailLabel: "Support email",
      detailsEmailValue: "info@peekr.app",
      detailsWebsiteLabel: "Website",
      detailsWebsiteValue: "www.peekr.app",
      closing:
        "If you need help with the service, account issues, legal requests, or general questions about Peekr, please use the contact page or email info@peekr.app.",
    },
    es: {
      eyebrow: "Acerca de Peekr",
      title: "Peekr es propiedad y es operada por Emanation Films, Inc.",
      intro:
        "Peekr es una plataforma social para películas y series donde los usuarios pueden registrar lo que ven, calificar títulos, descubrir actores y creadores, y compartir su gusto mediante actividad social y listas curadas.",
      companyTitle: "La empresa",
      companyBody1:
        "Peekr es propiedad y es operada por Emanation Films, Inc., la empresa responsable del desarrollo, operación, soporte y distribución pública de la plataforma Peekr y sus servicios relacionados.",
      companyBody2:
        "Emanation Films, Inc. administra el sitio web de Peekr, su presencia en apps, sus canales de soporte y sus comunicaciones oficiales.",
      missionTitle: "Qué hace Peekr",
      missionBody:
        "Peekr ayuda a las personas a descubrir películas y series mediante ratings, comentarios, actividad de visualización, colecciones editoriales y funciones de descubrimiento social. La plataforma está diseñada para hacer el descubrimiento de entretenimiento más social, personal e interactivo.",
      supportTitle: "Soporte",
      supportBody:
        "Para soporte, servicio al cliente, problemas técnicos, solicitudes de privacidad o consultas comerciales, contáctenos a través de nuestra página pública de contacto o por correo electrónico.",
      supportCta: "Contactar soporte",
      legalTitle: "Enlaces legales y de políticas",
      privacy: "Política de Privacidad",
      terms: "Términos del Servicio",
      contact: "Contacto",
      detailsTitle: "Datos de la empresa",
      detailsNameLabel: "Entidad legal",
      detailsNameValue: "Emanation Films, Inc.",
      detailsProductLabel: "Producto",
      detailsProductValue: "Peekr",
      detailsEmailLabel: "Email de soporte",
      detailsEmailValue: "info@peekr.app",
      detailsWebsiteLabel: "Sitio web",
      detailsWebsiteValue: "www.peekr.app",
      closing:
        "Si necesita ayuda con el servicio, problemas de cuenta, solicitudes legales o consultas generales sobre Peekr, utilice la página de contacto o escriba a info@peekr.app.",
    },
    pt: {
      eyebrow: "Sobre o Peekr",
      title: "Peekr é de propriedade e operado por Emanation Films, Inc.",
      intro:
        "Peekr é uma plataforma social para filmes e séries onde os usuários podem registrar o que assistem, avaliar títulos, descobrir atores e criadores e compartilhar gosto por meio de atividade social e listas curadas.",
      companyTitle: "A empresa",
      companyBody1:
        "Peekr é de propriedade e operado por Emanation Films, Inc., a empresa responsável pelo desenvolvimento, operação, suporte e distribuição pública da plataforma Peekr e de seus serviços relacionados.",
      companyBody2:
        "A Emanation Films, Inc. administra o site do Peekr, sua presença em aplicativos, seus canais de suporte e suas comunicações oficiais.",
      missionTitle: "O que o Peekr faz",
      missionBody:
        "Peekr ajuda as pessoas a descobrir filmes e séries por meio de avaliações, comentários, atividade de visualização, coleções editoriais e recursos de descoberta social. A plataforma foi criada para tornar a descoberta de entretenimento mais social, pessoal e interativa.",
      supportTitle: "Suporte",
      supportBody:
        "Para suporte, atendimento ao cliente, problemas técnicos, solicitações de privacidade ou consultas comerciais, entre em contato por nossa página pública de contato ou por e-mail.",
      supportCta: "Entrar em contato",
      legalTitle: "Links legais e de políticas",
      privacy: "Política de Privacidade",
      terms: "Termos de Serviço",
      contact: "Contato",
      detailsTitle: "Dados da empresa",
      detailsNameLabel: "Entidade legal",
      detailsNameValue: "Emanation Films, Inc.",
      detailsProductLabel: "Produto",
      detailsProductValue: "Peekr",
      detailsEmailLabel: "E-mail de suporte",
      detailsEmailValue: "info@peekr.app",
      detailsWebsiteLabel: "Site",
      detailsWebsiteValue: "www.peekr.app",
      closing:
        "Se você precisar de ajuda com o serviço, problemas de conta, solicitações legais ou dúvidas gerais sobre o Peekr, use a página de contato ou envie um e-mail para info@peekr.app.",
    },
  }[lang];

  return (
    <>
      <style>{`
        .about-page {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 960px;
          margin: 0 auto;
          color: white;
        }

        .about-hero {
          padding-top: 6px;
        }

        .about-eyebrow {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(250, 0, 130, 0.12);
          color: #FA0082;
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 18px;
        }

        .about-hero h1 {
          margin: 0;
          font-size: clamp(34px, 8vw, 62px);
          line-height: 0.98;
          font-weight: 900;
          letter-spacing: -0.04em;
          max-width: 900px;
        }

        .about-intro {
          margin-top: 18px;
          max-width: 820px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.8;
        }

        .about-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }

        .about-card {
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          padding: 22px;
        }

        .about-card h2 {
          margin: 0 0 12px 0;
          font-size: 24px;
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .about-card p {
          margin: 0 0 12px 0;
          color: rgba(255,255,255,0.76);
          font-size: 15px;
          line-height: 1.8;
        }

        .about-card p:last-child {
          margin-bottom: 0;
        }

        .about-links {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 14px;
        }

        .about-btn,
        .about-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border-radius: 14px;
          padding: 12px 16px;
          font-weight: 800;
          font-size: 14px;
        }

        .about-btn {
          background: #FA0082;
          color: white;
        }

        .about-link {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          color: white;
        }

        .details-list {
          display: grid;
          gap: 14px;
          margin-top: 8px;
        }

        .details-row {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .details-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .details-label {
          color: rgba(255,255,255,0.56);
          font-size: 13px;
          font-weight: 700;
        }

        .details-value {
          color: white;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.5;
          word-break: break-word;
        }

        .about-closing {
          color: rgba(255,255,255,0.68);
          font-size: 15px;
          line-height: 1.8;
          margin-top: 4px;
        }

        @media (min-width: 900px) {
          .about-grid {
            grid-template-columns: 1.1fr 0.9fr;
          }
        }
      `}</style>

      <div className="about-page">
        <section className="about-hero">
          <div className="about-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p className="about-intro">{t.intro}</p>
        </section>

        <section className="about-grid">
          <div className="about-card">
            <h2>{t.companyTitle}</h2>
            <p>{t.companyBody1}</p>
            <p>{t.companyBody2}</p>

            <h2 style={{ marginTop: 22 }}>{t.missionTitle}</h2>
            <p>{t.missionBody}</p>

            <h2 style={{ marginTop: 22 }}>{t.supportTitle}</h2>
            <p>{t.supportBody}</p>

            <div className="about-links">
              <a href="/contact" className="about-btn">
                {t.supportCta}
              </a>
              <a href="/privacy" className="about-link">
                {t.privacy}
              </a>
              <a href="/terms" className="about-link">
                {t.terms}
              </a>
            </div>
          </div>

          <div className="about-card">
            <h2>{t.detailsTitle}</h2>

            <div className="details-list">
              <div className="details-row">
                <div className="details-label">{t.detailsNameLabel}</div>
                <div className="details-value">{t.detailsNameValue}</div>
              </div>

              <div className="details-row">
                <div className="details-label">{t.detailsProductLabel}</div>
                <div className="details-value">{t.detailsProductValue}</div>
              </div>

              <div className="details-row">
                <div className="details-label">{t.detailsEmailLabel}</div>
                <div className="details-value">
                  <a
                    href="mailto:info@peekr.app"
                    style={{ color: "white", textDecoration: "none" }}
                  >
                    {t.detailsEmailValue}
                  </a>
                </div>
              </div>

              <div className="details-row">
                <div className="details-label">{t.detailsWebsiteLabel}</div>
                <div className="details-value">{t.detailsWebsiteValue}</div>
              </div>
            </div>

            <h2 style={{ marginTop: 22 }}>{t.legalTitle}</h2>
            <div className="about-links">
              <a href="/privacy" className="about-link">
                {t.privacy}
              </a>
              <a href="/terms" className="about-link">
                {t.terms}
              </a>
              <a href="/contact" className="about-link">
                {t.contact}
              </a>
            </div>
          </div>
        </section>

        <p className="about-closing">{t.closing}</p>
      </div>
    </>
  );
}
