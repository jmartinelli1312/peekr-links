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
    title: "Contact Peekr",
    description:
      "Contact Peekr support. Peekr is owned and operated by Emanation Films, Inc. Reach customer support, technical help, and privacy assistance at info@peekr.app.",
    alternates: {
      canonical: "https://www.peekr.app/contact",
    },
    openGraph: {
      title: "Contact Peekr",
      description:
        "Public support and contact page for Peekr and Emanation Films, Inc.",
      url: "https://www.peekr.app/contact",
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Contact Peekr",
      description:
        "Public support and contact page for Peekr and Emanation Films, Inc.",
    },
  };
}

export default async function ContactPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      eyebrow: "Contact",
      title: "Customer support and contact for Peekr",
      intro:
        "Peekr is owned and operated by Emanation Films, Inc. If you need customer support, technical assistance, help with your account, privacy requests, or business information, contact us using the email below.",
      supportTitle: "Support email",
      supportText:
        "For all support requests, please email us and include as much detail as possible so our team can help you faster.",
      emailLabel: "Email",
      emailValue: "info@peekr.app",
      responseTitle: "Support scope",
      response1: "Account support and login issues",
      response2: "Technical problems and bug reports",
      response3: "Privacy and data requests",
      response4: "Business, partnership, and legal inquiries",
      companyTitle: "Company information",
      companyBody:
        "Peekr is a social platform for movies and series owned and operated by Emanation Films, Inc.",
      legalTitle: "Useful links",
      about: "About",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      note:
        "By contacting us, you may provide personal information such as your email address and the content of your message. Please review our Privacy Policy for more information.",
    },
    es: {
      eyebrow: "Contacto",
      title: "Soporte al cliente y contacto de Peekr",
      intro:
        "Peekr es propiedad y es operada por Emanation Films, Inc. Si necesita soporte al cliente, asistencia técnica, ayuda con su cuenta, solicitudes de privacidad o información comercial, contáctenos usando el correo que aparece abajo.",
      supportTitle: "Correo de soporte",
      supportText:
        "Para cualquier solicitud de soporte, escríbanos por email e incluya la mayor cantidad de detalle posible para que nuestro equipo pueda ayudarle más rápido.",
      emailLabel: "Correo",
      emailValue: "info@peekr.app",
      responseTitle: "Alcance del soporte",
      response1: "Soporte de cuenta y problemas de acceso",
      response2: "Problemas técnicos y reporte de errores",
      response3: "Solicitudes de privacidad y datos",
      response4: "Consultas comerciales, alianzas y asuntos legales",
      companyTitle: "Información de la empresa",
      companyBody:
        "Peekr es una plataforma social para películas y series propiedad y operada por Emanation Films, Inc.",
      legalTitle: "Enlaces útiles",
      about: "Acerca de",
      privacy: "Política de Privacidad",
      terms: "Términos del Servicio",
      note:
        "Al contactarnos, usted puede proporcionar información personal como su correo electrónico y el contenido de su mensaje. Revise nuestra Política de Privacidad para más información.",
    },
    pt: {
      eyebrow: "Contato",
      title: "Suporte ao cliente e contato do Peekr",
      intro:
        "Peekr é de propriedade e operado por Emanation Films, Inc. Se você precisar de suporte ao cliente, assistência técnica, ajuda com sua conta, solicitações de privacidade ou informações comerciais, entre em contato usando o e-mail abaixo.",
      supportTitle: "E-mail de suporte",
      supportText:
        "Para qualquer solicitação de suporte, envie um e-mail com o máximo de detalhes possível para que nossa equipe possa ajudar mais rapidamente.",
      emailLabel: "E-mail",
      emailValue: "info@peekr.app",
      responseTitle: "Escopo do suporte",
      response1: "Suporte de conta e problemas de login",
      response2: "Problemas técnicos e relato de bugs",
      response3: "Solicitações de privacidade e dados",
      response4: "Consultas comerciais, parcerias e assuntos legais",
      companyTitle: "Informações da empresa",
      companyBody:
        "Peekr é uma plataforma social para filmes e séries de propriedade e operada por Emanation Films, Inc.",
      legalTitle: "Links úteis",
      about: "Sobre",
      privacy: "Política de Privacidade",
      terms: "Termos de Serviço",
      note:
        "Ao entrar em contato conosco, você pode fornecer informações pessoais como seu e-mail e o conteúdo da sua mensagem. Consulte nossa Política de Privacidade para mais informações.",
    },
  }[lang];

  return (
    <>
      <style>{`
        .contact-page {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 920px;
          margin: 0 auto;
          color: white;
        }

        .contact-hero {
          padding-top: 6px;
        }

        .contact-eyebrow {
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

        .contact-hero h1 {
          margin: 0;
          font-size: clamp(34px, 8vw, 60px);
          line-height: 0.98;
          font-weight: 900;
          letter-spacing: -0.04em;
          max-width: 840px;
        }

        .contact-intro {
          margin-top: 18px;
          max-width: 820px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.8;
        }

        .contact-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }

        .contact-card {
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          padding: 22px;
        }

        .contact-card h2 {
          margin: 0 0 12px 0;
          font-size: 24px;
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .contact-card p {
          margin: 0 0 12px 0;
          color: rgba(255,255,255,0.76);
          font-size: 15px;
          line-height: 1.8;
        }

        .contact-card p:last-child {
          margin-bottom: 0;
        }

        .email-box {
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          text-decoration: none;
          color: white;
          font-weight: 800;
          font-size: 15px;
          word-break: break-word;
        }

        .bullet-list {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }

        .bullet-item {
          color: rgba(255,255,255,0.82);
          font-size: 15px;
          line-height: 1.7;
        }

        .contact-links {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 14px;
        }

        .contact-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border-radius: 14px;
          padding: 12px 16px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          color: white;
          font-weight: 800;
          font-size: 14px;
        }

        .contact-note {
          color: rgba(255,255,255,0.64);
          font-size: 14px;
          line-height: 1.8;
        }

        @media (min-width: 900px) {
          .contact-grid {
            grid-template-columns: 1.05fr 0.95fr;
          }
        }
      `}</style>

      <div className="contact-page">
        <section className="contact-hero">
          <div className="contact-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p className="contact-intro">{t.intro}</p>
        </section>

        <section className="contact-grid">
          <div className="contact-card">
            <h2>{t.supportTitle}</h2>
            <p>{t.supportText}</p>

            <a href="mailto:info@peekr.app" className="email-box">
              {t.emailLabel}: {t.emailValue}
            </a>

            <h2 style={{ marginTop: 24 }}>{t.responseTitle}</h2>
            <div className="bullet-list">
              <div className="bullet-item">• {t.response1}</div>
              <div className="bullet-item">• {t.response2}</div>
              <div className="bullet-item">• {t.response3}</div>
              <div className="bullet-item">• {t.response4}</div>
            </div>
          </div>

          <div className="contact-card">
            <h2>{t.companyTitle}</h2>
            <p>{t.companyBody}</p>

            <div className="contact-links">
              <a href="/about" className="contact-link">
                {t.about}
              </a>
              <a href="/privacy" className="contact-link">
                {t.privacy}
              </a>
              <a href="/terms" className="contact-link">
                {t.terms}
              </a>
            </div>

            <p className="contact-note" style={{ marginTop: 20 }}>
              {t.note}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
