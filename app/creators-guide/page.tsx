export const dynamic = "force-dynamic";

import { cookies } from "next/headers";

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("en")) return "en";
  return "es";
}

export async function generateMetadata() {
  return {
    title: "Peekr Creator Guide",
    description:
      "Everything you unlock as a verified Peekr Creator and how to use it: verified badge, bio links, social icons, SneakPeeks, imports and unlimited lists.",
    alternates: { canonical: "https://www.peekr.app/creators-guide" },
    openGraph: {
      title: "Peekr Creator Guide",
      description:
        "Everything you unlock as a verified Peekr Creator and how to use it.",
      url: "https://www.peekr.app/creators-guide",
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Peekr Creator Guide",
      description:
        "Everything you unlock as a verified Peekr Creator and how to use it.",
    },
  };
}

type Perk = {
  n: string;
  title: string;
  body: string;
  important?: string;
  how: string;
};
type Copy = {
  eyebrow: string;
  title: string;
  intro: string;
  howLabel: string;
  importantLabel: string;
  perks: Perk[];
  ctaTitle: string;
  ctaBody: string;
  ctaBtn: string;
};

const COPY: Record<Lang, Copy> = {
  es: {
    eyebrow: "Guía del Creator",
    title: "Todo lo que desbloqueas como Creator de Peekr",
    intro:
      "¡Felicitaciones! Ya eres un Creator verificado. Esta es tu guía con todos los beneficios que tienes y cómo usarlos.",
    howLabel: "Cómo acceder",
    importantLabel: "Importante",
    perks: [
      {
        n: "01",
        title: "Insignia verificada",
        body: "Tu insignia de verificado aparece junto a tu @usuario en todo Peekr — perfil, comentarios, feed y listas. Le da credibilidad y autoridad a tu cuenta.",
        how: "Se activa automáticamente al ser aprobado. No tienes que hacer nada.",
      },
      {
        n: "02",
        title: "Bio con enlaces clicables",
        body: "Tu biografía admite hyperlinks. Pega URLs (tu web, YouTube, Linktree, etc.) y se vuelven clicables para llevar tráfico a donde quieras.",
        how: "Perfil → Editar perfil → Biografía. Pega tus links y guarda.",
      },
      {
        n: "03",
        title: "Instagram y TikTok en tu perfil",
        body: "Mostrá tus redes con íconos de Instagram y TikTok directamente en tu perfil. Tus seguidores te encuentran en un toque.",
        how: "Perfil → Editar perfil → agrega tus usuarios de Instagram y TikTok.",
      },
      {
        n: "04",
        title: "SneakPeeks: carrusel y video",
        body: "Publicá adelantos, reseñas y reacciones en formato carrusel o video. Es tu contenido destacado dentro de Peekr.",
        important:
          "Referencia siempre el título. Al hacerlo: (1) se unifican los comentarios del SneakPeek con los del título, (2) se crea un link para que el usuario acceda al título, y (3) cuando alguien toca Guardar/Bookmark, el título se agrega directo a sus listas.",
        how: "Perfil → SneakPeeks → Crear → selecciona el título referenciado, sube tu carrusel o video y publica.",
      },
      {
        n: "05",
        title: "Importá tu historial (Letterboxd y Netflix)",
        body: "Trae todo tu historial de Letterboxd y Netflix a Peekr en minutos, con tus ratings y reseñas. Exclusivo para creators.",
        how: "Desde la web peekr.app → tu perfil → Imports. (Disponible solo en la web.)",
      },
      {
        n: "06",
        title: "Listas ilimitadas",
        body: "Crea todas las listas (peeklists) que quieras, sin límite. Arma colecciones temáticas, rankings y recomendaciones para tu audiencia.",
        how: "Perfil → Listas → Crear nueva lista. Sin tope.",
      },
    ],
    ctaTitle: "¿Listo para empezar?",
    ctaBody:
      "Sube al menos 5 SneakPeeks desde tu perfil para activar tu contenido en el feed.",
    ctaBtn: "Abrir Peekr",
  },
  en: {
    eyebrow: "Creator Guide",
    title: "Everything you unlock as a Peekr Creator",
    intro:
      "Congratulations! You're now a verified Creator. This is your guide to every perk you have and how to use it.",
    howLabel: "How to access",
    importantLabel: "Important",
    perks: [
      {
        n: "01",
        title: "Verified badge",
        body: "Your verified badge appears next to your @username across all of Peekr — profile, comments, feed and lists. It gives your account credibility and authority.",
        how: "It's activated automatically on approval. Nothing to do.",
      },
      {
        n: "02",
        title: "Bio with clickable links",
        body: "Your bio supports hyperlinks. Paste URLs (your site, YouTube, Linktree, etc.) and they become clickable to drive traffic wherever you want.",
        how: "Profile → Edit profile → Bio. Paste your links and save.",
      },
      {
        n: "03",
        title: "Instagram and TikTok on your profile",
        body: "Show your socials with Instagram and TikTok icons right on your profile. Your followers find you in one tap.",
        how: "Profile → Edit profile → add your Instagram and TikTok handles.",
      },
      {
        n: "04",
        title: "SneakPeeks: carousel and video",
        body: "Post previews, reviews and reactions as a carousel or video. It's your featured content inside Peekr.",
        important:
          "Always reference the title. When you do: (1) the SneakPeek's comments are unified with the title's comments, (2) a link is created so users can open the title, and (3) when someone taps Save/Bookmark, the title is added straight to their lists.",
        how: "Profile → SneakPeeks → Create → pick the referenced title, upload your carousel or video and publish.",
      },
      {
        n: "05",
        title: "Import your history (Letterboxd and Netflix)",
        body: "Bring your entire Letterboxd and Netflix history into Peekr in minutes, with your ratings and reviews. Creators only.",
        how: "On the web at peekr.app → your profile → Imports. (Available on web only.)",
      },
      {
        n: "06",
        title: "Unlimited lists",
        body: "Create as many lists (peeklists) as you want, no limit. Build themed collections, rankings and recommendations for your audience.",
        how: "Profile → Lists → Create new list. No cap.",
      },
    ],
    ctaTitle: "Ready to start?",
    ctaBody:
      "Upload at least 5 SneakPeeks from your profile to activate your content in the feed.",
    ctaBtn: "Open Peekr",
  },
  pt: {
    eyebrow: "Guia do Creator",
    title: "Tudo o que você desbloqueia como Creator do Peekr",
    intro:
      "Parabéns! Você agora é um Creator verificado. Este é o seu guia de todos os benefícios que você tem e como usá-los.",
    howLabel: "Como acessar",
    importantLabel: "Importante",
    perks: [
      {
        n: "01",
        title: "Selo verificado",
        body: "Seu selo de verificado aparece ao lado do seu @usuário em todo o Peekr — perfil, comentários, feed e listas. Dá credibilidade e autoridade à sua conta.",
        how: "É ativado automaticamente na aprovação. Nada a fazer.",
      },
      {
        n: "02",
        title: "Bio com links clicáveis",
        body: "Sua biografia aceita hyperlinks. Cole URLs (seu site, YouTube, Linktree, etc.) e eles ficam clicáveis para levar tráfego para onde quiser.",
        how: "Perfil → Editar perfil → Biografia. Cole seus links e salve.",
      },
      {
        n: "03",
        title: "Instagram e TikTok no seu perfil",
        body: "Mostre suas redes com ícones de Instagram e TikTok direto no seu perfil. Seus seguidores te encontram em um toque.",
        how: "Perfil → Editar perfil → adicione seus usuários de Instagram e TikTok.",
      },
      {
        n: "04",
        title: "SneakPeeks: carrossel e vídeo",
        body: "Publique prévias, reviews e reações em formato carrossel ou vídeo. É o seu conteúdo em destaque dentro do Peekr.",
        important:
          "Sempre referencie o título. Ao fazer isso: (1) os comentários do SneakPeek se unificam com os do título, (2) é criado um link para o usuário acessar o título, e (3) quando alguém toca em Salvar/Bookmark, o título é adicionado direto às listas dele.",
        how: "Perfil → SneakPeeks → Criar → selecione o título referenciado, suba seu carrossel ou vídeo e publique.",
      },
      {
        n: "05",
        title: "Importe seu histórico (Letterboxd e Netflix)",
        body: "Traga todo o seu histórico de Letterboxd e Netflix para o Peekr em minutos, com suas avaliações e reviews. Exclusivo para creators.",
        how: "Na web em peekr.app → seu perfil → Imports. (Disponível só na web.)",
      },
      {
        n: "06",
        title: "Listas ilimitadas",
        body: "Crie quantas listas (peeklists) quiser, sem limite. Monte coleções temáticas, rankings e recomendações para a sua audiência.",
        how: "Perfil → Listas → Criar nova lista. Sem limite.",
      },
    ],
    ctaTitle: "Pronto para começar?",
    ctaBody:
      "Suba pelo menos 5 SneakPeeks pelo seu perfil para ativar seu conteúdo no feed.",
    ctaBtn: "Abrir Peekr",
  },
};

export default async function CreatorsGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const lang = normalizeLang(sp?.lang || cookieStore.get("lang")?.value);
  const t = COPY[lang];

  return (
    <>
      <style>{`
        .cg-page { display:flex; flex-direction:column; gap:28px; max-width:960px; margin:0 auto; color:white; }
        .cg-eyebrow { display:inline-flex; align-items:center; padding:8px 12px; border-radius:999px; background:rgba(250,0,130,0.12); color:#FA0082; font-weight:800; font-size:13px; margin-bottom:18px; }
        .cg-hero h1 { margin:0; font-size:clamp(32px,7vw,56px); line-height:1.0; font-weight:900; letter-spacing:-0.04em; max-width:860px; }
        .cg-intro { margin-top:18px; max-width:760px; color:rgba(255,255,255,0.74); font-size:17px; line-height:1.7; }
        .cg-grid { display:grid; grid-template-columns:1fr; gap:16px; }
        .cg-card { border-radius:22px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); padding:24px; }
        .cg-card-head { display:flex; align-items:baseline; gap:14px; margin-bottom:10px; }
        .cg-num { font-size:14px; font-weight:900; color:#FA0082; letter-spacing:0.04em; }
        .cg-card h2 { margin:0; font-size:21px; line-height:1.15; font-weight:900; letter-spacing:-0.02em; }
        .cg-card p { margin:0; color:rgba(255,255,255,0.76); font-size:15px; line-height:1.7; }
        .cg-important { margin-top:14px; border-radius:14px; border:1px solid rgba(250,0,130,0.25); background:rgba(250,0,130,0.08); padding:14px 16px; }
        .cg-important .lbl { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:#FA0082; margin-bottom:6px; }
        .cg-important p { color:rgba(255,255,255,0.86); font-size:14px; }
        .cg-how { margin-top:14px; border-top:1px solid rgba(255,255,255,0.07); padding-top:12px; }
        .cg-how .lbl { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:rgba(255,255,255,0.42); margin-bottom:4px; }
        .cg-how p { font-size:14px; color:rgba(255,255,255,0.82); }
        .cg-cta { border-radius:22px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(180deg,rgba(250,0,130,0.10),rgba(255,255,255,0.02)); padding:28px; text-align:center; }
        .cg-cta h2 { margin:0 0 8px 0; font-size:24px; font-weight:900; letter-spacing:-0.02em; }
        .cg-cta p { margin:0 0 20px 0; color:rgba(255,255,255,0.74); font-size:15px; line-height:1.6; }
        .cg-btn { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; border-radius:14px; padding:13px 26px; font-weight:800; font-size:15px; background:#FA0082; color:white; }
        @media (min-width:820px){ .cg-grid { grid-template-columns:1fr 1fr; } }
      `}</style>

      <div className="cg-page">
        <section className="cg-hero">
          <div className="cg-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p className="cg-intro">{t.intro}</p>
        </section>

        <section className="cg-grid">
          {t.perks.map((p) => (
            <div className="cg-card" key={p.n}>
              <div className="cg-card-head">
                <span className="cg-num">{p.n}</span>
                <h2>{p.title}</h2>
              </div>
              <p>{p.body}</p>
              {p.important && (
                <div className="cg-important">
                  <div className="lbl">{t.importantLabel}</div>
                  <p>{p.important}</p>
                </div>
              )}
              <div className="cg-how">
                <div className="lbl">{t.howLabel}</div>
                <p>{p.how}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="cg-cta">
          <h2>{t.ctaTitle}</h2>
          <p>{t.ctaBody}</p>
          <a href="https://peekr.app/go" className="cg-btn">
            {t.ctaBtn}
          </a>
        </section>
      </div>
    </>
  );
}
