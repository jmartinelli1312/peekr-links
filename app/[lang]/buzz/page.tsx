export const revalidate = 86400; // 24h — listing de artículos

import Link from "next/link";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";
const SITE = "https://www.peekr.app";

type Lang = "en" | "es" | "pt";

type PageProps = {
  params: Promise<{ lang: string }>;
};

type BuzzArticle = {
  id: number;
  slug: string;
  title: string;
  summary?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  category?: string | null;
  is_published: boolean;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

function decodeHtmlEntities(input?: string | null) {
  if (!input) return "";
  return input
    .replace(/&#8216;|&#8242;|&lsquo;/g, "‘")
    .replace(/&#8217;|&#8243;|&rsquo;/g, "’")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#038;|&#38;|&amp;/g, "&")
    .replace(/&quot;/g, `"`)
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#8230;|&hellip;/g, "…");
}

function formatDate(value?: string | null, lang: Lang = "en") {
  if (!value) return "";
  try {
    const locale =
      lang === "es" ? "es-ES" : lang === "pt" ? "pt-BR" : "en-US";

    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function categoryLabel(category?: string | null, lang: Lang = "en") {
  const map = {
    en: {
      awards: "Awards",
      casting: "Casting",
      trailers: "Trailers",
      streaming: "Streaming",
      box_office: "Box Office",
      tv: "TV",
      movies: "Movies",
      reviews: "Reviews",
    },
    es: {
      awards: "Premios",
      casting: "Casting",
      trailers: "Trailers",
      streaming: "Streaming",
      box_office: "Taquilla",
      tv: "Series",
      movies: "Películas",
      reviews: "Reviews",
    },
    pt: {
      awards: "Prêmios",
      casting: "Casting",
      trailers: "Trailers",
      streaming: "Streaming",
      box_office: "Bilheteria",
      tv: "Séries",
      movies: "Filmes",
      reviews: "Reviews",
    },
  }[lang];

  return map[(category as keyof typeof map) || "movies"] || category || "";
}

function getStrings(lang: Lang) {
  return {
    en: {
      pageTitle: "PeekrBuzz – Movie & TV News, Trailers and Casting",
      metaDescription:
        "Latest news on movies, TV shows, streaming, trailers, casting and awards. Updated daily on Peekr.",
      title: "PeekrBuzz",
      subtitle:
        "Fresh stories from movies, TV, streaming, trailers, casting and awards.",
      latestTitle: "Latest stories",
      latestText:
        "Entertainment headlines curated for discovery across movies and series.",
    },
    es: {
      pageTitle: "PeekrBuzz – Noticias de Cine, Series y Streaming",
      metaDescription:
        "Noticias de películas, series, streaming, trailers, casting y premios. Actualizadas a diario en Peekr.",
      title: "PeekrBuzz",
      subtitle:
        "Historias frescas sobre películas, series, streaming, trailers, casting y premios.",
      latestTitle: "Últimas historias",
      latestText:
        "Titulares de entretenimiento curados para discovery en películas y series.",
    },
    pt: {
      pageTitle: "PeekrBuzz – Notícias de Cinema, Séries e Streaming",
      metaDescription:
        "Notícias de filmes, séries, streaming, trailers, casting e prêmios. Atualizadas diariamente no Peekr.",
      title: "PeekrBuzz",
      subtitle:
        "Histórias frescas sobre filmes, séries, streaming, trailers, casting e prêmios.",
      latestTitle: "Últimas histórias",
      latestText:
        "Manchetes de entretenimento curadas para discovery em filmes e séries.",
    },
  }[lang];
}

async function getBuzzArticles(lang: Lang) {
  const { data } = await supabase
    .from("peekrbuzz_articles")
    .select(
      "id,slug,title,summary,source_name,source_url,image_url,published_at,category,is_published"
    )
    .eq("is_published", true)
    .eq("language", lang)
    .order("published_at", { ascending: false })
    .limit(60);

  return (data as BuzzArticle[] | null) ?? [];
}

function SectionHeader({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function FeaturedCard({
  item,
  lang,
}: {
  item: BuzzArticle;
  lang: Lang;
}) {
  const cleanTitle = decodeHtmlEntities(item.title);
  const cleanSummary = decodeHtmlEntities(item.summary);

  return (
    <Link href={`/${lang}/buzz/${item.slug}`} className="featured-card">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={cleanTitle}
          className="featured-image"
        />
      ) : (
        <div className="featured-image featured-fallback" />
      )}

      <div className="featured-overlay" />

      <div className="featured-content">
        <div className="featured-badges">
          {item.category ? (
            <span className="buzz-badge">
              {categoryLabel(item.category, lang)}
            </span>
          ) : null}
          {item.source_name ? (
            <span className="buzz-source">{item.source_name}</span>
          ) : null}
        </div>

        <h2>{cleanTitle}</h2>

        {cleanSummary ? <p>{cleanSummary}</p> : null}

        <div className="featured-date">
          {formatDate(item.published_at, lang)}
        </div>
      </div>
    </Link>
  );
}

function ArticleGrid({
  items,
  lang,
}: {
  items: BuzzArticle[];
  lang: Lang;
}) {
  return (
    <div className="buzz-grid">
      {items.map((item) => {
        const cleanTitle = decodeHtmlEntities(item.title);
        const cleanSummary = decodeHtmlEntities(item.summary);

        return (
          <Link
            key={item.id}
            href={`/${lang}/buzz/${item.slug}`}
            className="buzz-card"
          >
            {item.image_url ? (
              <img src={item.image_url} alt={cleanTitle} className="buzz-image" />
            ) : (
              <div className="buzz-image buzz-fallback" />
            )}

            <div className="buzz-meta">
              <div className="buzz-topline">
                {item.category ? (
                  <span className="buzz-badge">
                    {categoryLabel(item.category, lang)}
                  </span>
                ) : null}
                {item.source_name ? (
                  <span className="buzz-source">{item.source_name}</span>
                ) : null}
              </div>

              <div className="buzz-title">{cleanTitle}</div>

              {cleanSummary ? (
                <div className="buzz-summary">{cleanSummary}</div>
              ) : null}

              <div className="buzz-date">
                {formatDate(item.published_at, lang)}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { lang: rawLang } = await params;
  const lang = normalizeLang(rawLang);
  const t = getStrings(lang);

  return {
    title: t.pageTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `${SITE}/${lang}/buzz`,
      languages: {
        es: `${SITE}/es/buzz`,
        en: `${SITE}/en/buzz`,
        pt: `${SITE}/pt/buzz`,
        "x-default": `${SITE}/es/buzz`,
      },
    },
    openGraph: {
      title: t.pageTitle,
      description: t.metaDescription,
      url: `${SITE}/${lang}/buzz`,
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t.pageTitle,
      description: t.metaDescription,
    },
  };
}

export default async function BuzzPage({ params }: PageProps) {
  const { lang: rawLang } = await params;
  const lang = normalizeLang(rawLang);
  const t = getStrings(lang);

  const articles = await getBuzzArticles(lang);
  const featured = articles[0] ?? null;
  const rest = articles.slice(1);

  return (
    <>
      <style>{`
        .buzz-page {
          display: flex;
          flex-direction: column;
          gap: 40px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(44px, 10vw, 72px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
        }

        .hero p {
          margin: 18px 0 0 0;
          max-width: 860px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .section-header {
          margin-bottom: 18px;
        }

        .section-header h2 {
          margin: 0;
          font-size: clamp(30px, 7vw, 38px);
          line-height: 1.02;
          color: white;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .section-header p {
          margin: 10px 0 0 0;
          color: rgba(255,255,255,0.70);
          font-size: 15px;
          line-height: 1.7;
          max-width: 840px;
        }

        .featured-card {
          position: relative;
          display: block;
          min-height: 400px;
          border-radius: 24px;
          overflow: hidden;
          text-decoration: none;
          color: white;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .featured-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .featured-fallback {
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
        }

        .featured-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(10,10,14,0.05) 0%, rgba(10,10,14,0.68) 65%, rgba(10,10,14,0.95) 100%);
        }

        .featured-content {
          position: relative;
          z-index: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 400px;
        }

        .featured-badges,
        .buzz-topline {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .buzz-badge {
          display: inline-flex;
          align-items: center;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(250,0,130,0.16);
          color: ${BRAND};
          font-weight: 800;
          font-size: 12px;
        }

        .buzz-source {
          color: rgba(255,255,255,0.78);
          font-size: 12px;
          font-weight: 700;
        }

        .featured-content h2 {
          margin: 14px 0 0 0;
          font-size: clamp(28px, 7vw, 46px);
          line-height: 1.05;
          letter-spacing: -0.03em;
        }

        .featured-content p {
          margin: 14px 0 0 0;
          max-width: 800px;
          color: rgba(255,255,255,0.82);
          font-size: 15px;
          line-height: 1.75;
        }

        .featured-date,
        .buzz-date {
          margin-top: 14px;
          color: rgba(255,255,255,0.60);
          font-size: 12px;
          font-weight: 700;
        }

        .buzz-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .buzz-card {
          display: grid;
          grid-template-columns: 108px 1fr;
          gap: 14px;
          text-decoration: none;
          color: white;
          padding: 14px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .buzz-image,
        .buzz-fallback {
          width: 108px;
          height: 108px;
          border-radius: 14px;
          object-fit: cover;
          display: block;
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
        }

        .buzz-meta {
          min-width: 0;
        }

        .buzz-title {
          margin-top: 10px;
          font-size: 16px;
          line-height: 1.4;
          font-weight: 800;
          color: rgba(255,255,255,0.96);
        }

        .buzz-summary {
          margin-top: 8px;
          font-size: 14px;
          line-height: 1.65;
          color: rgba(255,255,255,0.70);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (min-width: 900px) {
          .buzz-page {
            gap: 56px;
          }

          .featured-card,
          .featured-content {
            min-height: 460px;
          }

          .featured-content {
            padding: 30px;
          }

          .buzz-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="buzz-page">
        <section className="hero">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </section>

        {featured ? <FeaturedCard item={featured} lang={lang} /> : null}

        {rest.length > 0 ? (
          <section>
            <SectionHeader title={t.latestTitle} text={t.latestText} />
            <ArticleGrid items={rest} lang={lang} />
          </section>
        ) : null}
      </div>
    </>
  );
}
