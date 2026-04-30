export const revalidate = 172800;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SITE = "https://www.peekr.app";
const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

type PageProps = {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
};

type RelatedTitle = {
  tmdb_id: number;
  media_type: string;
  title: string;
  year?: string | null;
};

type BuzzArticle = {
  id: number;
  slug: string;
  title: string;
  summary?: string | null;
  body_html?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  category?: string | null;
  is_published: boolean;
  language?: string | null;
  topic_key?: string | null;
  related_titles?: RelatedTitle[] | null;
};

type BuzzSibling = {
  slug: string;
  language: string;
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

function stripHtml(html?: string | null) {
  if (!html) return "";
  return decodeHtmlEntities(
    html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  );
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
      back: "Back to Buzz",
      source: "Source",
      published: "Published",
      readOriginal: "Read original source",
      defaultDescription:
        "Latest movie, TV, streaming, trailer, casting and awards news on Peekr.",
      relatedTitles: "Titles in this article",
      seeOnPeekr: "See on Peekr",
    },
    es: {
      back: "Volver a Buzz",
      source: "Fuente",
      published: "Publicado",
      readOriginal: "Leer fuente original",
      defaultDescription:
        "Últimas noticias de películas, series, streaming, trailers, casting y premios en Peekr.",
      relatedTitles: "Títulos en este artículo",
      seeOnPeekr: "Ver en Peekr",
    },
    pt: {
      back: "Voltar para Buzz",
      source: "Fonte",
      published: "Publicado",
      readOriginal: "Ler fonte original",
      defaultDescription:
        "Últimas notícias de filmes, séries, streaming, trailers, casting e prêmios no Peekr.",
      relatedTitles: "Títulos neste artigo",
      seeOnPeekr: "Ver no Peekr",
    },
  }[lang];
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function getBuzzArticle(slug: string) {
  const { data, error } = await supabase
    .from("peekrbuzz_articles")
    .select(
      "id,slug,title,summary,body_html,source_name,source_url,image_url,published_at,category,is_published,language,topic_key,related_titles"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) return null;
  return (data as BuzzArticle | null) ?? null;
}

/**
 * Fetches every published sibling that shares this topic_key, so the
 * detail page can emit hreflang alternates pointing at the correct
 * per-language slug instead of assuming the same slug works in every
 * language (which it doesn't for auto-generated articles).
 */
async function getBuzzSiblings(topic_key: string): Promise<BuzzSibling[]> {
  const { data } = await supabase
    .from("peekrbuzz_articles")
    .select("slug,language")
    .eq("topic_key", topic_key)
    .eq("is_published", true);

  return (data as BuzzSibling[] | null) ?? [];
}

/**
 * Build hreflang alternates from the sibling set. Falls back to the same
 * slug for every language when no siblings exist (manual/legacy articles
 * that share one slug across all URLs).
 */
function buildLanguageAlternates(
  article: BuzzArticle,
  siblings: BuzzSibling[]
): Record<string, string> {
  const alternates: Record<string, string> = {};
  const siblingBySlugLang = new Map(
    siblings.map((s) => [s.language, s.slug] as const)
  );

  const articleLang = (article.language || "es").toLowerCase();
  siblingBySlugLang.set(articleLang, article.slug);

  for (const code of ["es", "en", "pt"] as const) {
    const slug = siblingBySlugLang.get(code) ?? article.slug;
    alternates[code] = `${SITE}/${code}/buzz/${slug}`;
  }
  alternates["x-default"] = alternates["es"];
  return alternates;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = normalizeLang(rawLang);
  const t = getStrings(lang);

  const article = await getBuzzArticle(slug);

  if (!article) {
    return {
      title: "PeekrBuzz | Peekr",
      description: t.defaultDescription,
    };
  }

  const siblings = article.topic_key
    ? await getBuzzSiblings(article.topic_key)
    : [];
  const languages = buildLanguageAlternates(article, siblings);
  const canonicalSlug = languages[lang]?.split("/").pop() || article.slug;

  const cleanTitle = decodeHtmlEntities(article.title);
  const cleanSummary =
    stripHtml(article.summary).slice(0, 155) || t.defaultDescription;

  return {
    title: `${cleanTitle} | PeekrBuzz`,
    description: cleanSummary,
    alternates: {
      canonical: `${SITE}/${lang}/buzz/${canonicalSlug}`,
      languages,
    },
    openGraph: {
      title: `${cleanTitle} | PeekrBuzz`,
      description: cleanSummary,
      url: `${SITE}/${lang}/buzz/${canonicalSlug}`,
      siteName: "Peekr",
      type: "article",
      images: article.image_url ? [{ url: article.image_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cleanTitle} | PeekrBuzz`,
      description: cleanSummary,
      images: article.image_url ? [article.image_url] : [],
    },
  };
}

export default async function BuzzArticlePage({ params }: PageProps) {
  const { lang: rawLang, slug } = await params;
  const lang = normalizeLang(rawLang);
  const t = getStrings(lang);

  const article = await getBuzzArticle(slug);

  if (!article) notFound();

  // Language redirect — if the URL language doesn't match the article's
  // native language, try to send the user to the correct version:
  //   1. If topic_key exists, look for a sibling in the requested language.
  //   2. If no sibling found (or no topic_key), fall back to the article's
  //      own language URL. This prevents /es/ and /pt/ from each declaring
  //      themselves canonical for an English-only article.
  const articleLang = (article.language || "es").toLowerCase() as Lang;
  if (articleLang !== lang) {
    if (article.topic_key) {
      const siblings = await getBuzzSiblings(article.topic_key);
      const sibling = siblings.find(
        (s) => (s.language || "").toLowerCase() === lang
      );
      if (sibling && sibling.slug !== article.slug) {
        redirect(`/${lang}/buzz/${sibling.slug}`);
      }
    }
    // No language-specific version exists — send to the article's native language
    redirect(`/${articleLang}/buzz/${article.slug}`);
  }

  const cleanTitle = decodeHtmlEntities(article.title);
  const cleanSummary = decodeHtmlEntities(article.summary);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: cleanTitle,
    description: stripHtml(article.summary).slice(0, 155) || t.defaultDescription,
    datePublished: article.published_at || undefined,
    dateModified: article.published_at || undefined,
    image: article.image_url ? [article.image_url] : undefined,
    mainEntityOfPage: `${SITE}/${lang}/buzz/${article.slug}`,
    publisher: {
      "@type": "Organization",
      name: "Peekr",
      url: SITE,
    },
    author: {
      "@type": "Organization",
      name: article.source_name || "Peekr",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Peekr",
        item: `${SITE}/${lang}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Buzz",
        item: `${SITE}/${lang}/buzz`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: cleanTitle,
        item: `${SITE}/${lang}/buzz/${article.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <style>{`
        .buzz-article-page {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .back-link {
          display: inline-flex;
          width: fit-content;
          color: rgba(255,255,255,0.72);
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
        }

        .hero {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .hero-topline {
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

        .source-name,
        .published-date {
          color: rgba(255,255,255,0.68);
          font-size: 13px;
          font-weight: 700;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(34px, 8vw, 64px);
          line-height: 1.02;
          letter-spacing: -0.04em;
          font-weight: 900;
          color: white;
          max-width: 980px;
        }

        .hero-summary {
          margin: 0;
          max-width: 860px;
          color: rgba(255,255,255,0.78);
          font-size: 17px;
          line-height: 1.75;
        }

        .hero-image,
        .hero-fallback {
          width: 100%;
          max-width: 980px;
          aspect-ratio: 16 / 9;
          border-radius: 24px;
          object-fit: cover;
          display: block;
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
          border: 1px solid rgba(255,255,255,0.08);
        }

        .meta-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .meta-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: white;
          font-size: 14px;
          font-weight: 700;
        }

        .source-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          text-decoration: none;
          border-radius: 16px;
          padding: 14px 18px;
          font-weight: 800;
          font-size: 15px;
          background: ${BRAND};
          color: white;
        }

        .content-wrap {
          max-width: 860px;
        }

        .content-wrap p {
          color: rgba(255,255,255,0.84);
          font-size: 17px;
          line-height: 1.9;
          margin: 0 0 20px 0;
        }

        .article-body {
          max-width: 860px;
          margin-top: 12px;
        }

        .article-body h2 {
          margin: 40px 0 16px 0;
          font-size: 28px;
          line-height: 1.15;
          letter-spacing: -0.02em;
          font-weight: 800;
          color: white;
        }

        .article-body h3 {
          margin: 32px 0 12px 0;
          font-size: 22px;
          line-height: 1.2;
          letter-spacing: -0.01em;
          font-weight: 700;
          color: white;
        }

        .article-body p {
          color: rgba(255,255,255,0.84);
          font-size: 17px;
          line-height: 1.9;
          margin: 0 0 20px 0;
        }

        .article-body ul,
        .article-body ol {
          color: rgba(255,255,255,0.84);
          font-size: 17px;
          line-height: 1.9;
          padding-left: 24px;
          margin: 0 0 20px 0;
        }

        .article-body li {
          margin-bottom: 8px;
        }

        .article-body a {
          color: ${BRAND};
          text-decoration: underline;
          text-decoration-color: rgba(250,0,130,0.4);
          text-underline-offset: 3px;
        }

        .article-body a:hover {
          text-decoration-color: ${BRAND};
        }

        .article-body strong {
          color: white;
          font-weight: 700;
        }

        .related-titles {
          margin-top: 36px;
          padding-top: 28px;
          border-top: 1px solid rgba(255,255,255,0.08);
          max-width: 860px;
        }

        .related-titles-heading {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 800;
          color: rgba(255,255,255,0.95);
          letter-spacing: -0.02em;
        }

        .related-titles-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .related-title-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 16px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          color: white;
          text-decoration: none;
          font-size: 15px;
          font-weight: 700;
          transition: background 0.15s;
        }

        .related-title-link:hover {
          background: rgba(255,255,255,0.07);
        }

        .related-title-name {
          flex: 1;
        }

        .related-title-year {
          font-size: 13px;
          color: rgba(255,255,255,0.50);
          font-weight: 400;
        }

        .related-title-type {
          font-size: 11px;
          color: rgba(250,0,130,0.8);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
      `}</style>

      <div className="buzz-article-page">
        <Link href={`/${lang}/buzz`} className="back-link">
          ← {t.back}
        </Link>

        <section className="hero">
          <div className="hero-topline">
            {article.category ? (
              <span className="buzz-badge">
                {categoryLabel(article.category, lang)}
              </span>
            ) : null}

            {article.source_name ? (
              <span className="source-name">{article.source_name}</span>
            ) : null}

            {article.published_at ? (
              <span className="published-date">
                {formatDate(article.published_at, lang)}
              </span>
            ) : null}
          </div>

          <h1>{cleanTitle}</h1>

          {cleanSummary ? <p className="hero-summary">{cleanSummary}</p> : null}

          {article.image_url ? (
            <img
              src={article.image_url}
              alt={cleanTitle}
              className="hero-image"
            />
          ) : (
            <div className="hero-fallback" />
          )}

          <div className="meta-row">
            {article.source_name ? (
              <div className="meta-pill">
                {t.source}: {article.source_name}
              </div>
            ) : null}

            {article.published_at ? (
              <div className="meta-pill">
                {t.published}: {formatDate(article.published_at, lang)}
              </div>
            ) : null}
          </div>

          {article.source_url ? (
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="source-link"
            >
              {t.readOriginal}
            </a>
          ) : null}
        </section>

        <section className="content-wrap">
          {cleanSummary ? <p>{cleanSummary}</p> : null}

          {article.body_html ? (
            <div
              className="article-body"
              dangerouslySetInnerHTML={{ __html: article.body_html }}
            />
          ) : null}

          {article.related_titles && article.related_titles.length > 0 ? (
            <div className="related-titles">
              <h2 className="related-titles-heading">{t.relatedTitles}</h2>
              <div className="related-titles-grid">
                {article.related_titles.map((rt) => (
                  <a
                    key={rt.tmdb_id}
                    href={`/${lang}/title/${rt.media_type}/${rt.tmdb_id}-${slugify(rt.title)}`}
                    className="related-title-link"
                  >
                    <span className="related-title-name">{rt.title}</span>
                    {rt.year ? (
                      <span className="related-title-year">{rt.year}</span>
                    ) : null}
                    <span className="related-title-type">
                      {rt.media_type === "tv" ? "Serie" : "Película"}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
