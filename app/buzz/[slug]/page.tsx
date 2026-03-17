export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const PROFILE = "https://image.tmdb.org/t/p/w185";
const POSTER = "https://image.tmdb.org/t/p/w342";
const SITE = "https://www.peekr.app";
const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
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

type RelatedTitle = {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  image_url?: string | null;
};

type RelatedPerson = {
  id: number;
  name: string;
  image_url?: string | null;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function tmdbLanguage(lang: Lang) {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
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
      month: "long",
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

function extractQuotedTitles(text: string) {
  const matches = [
    ...text.matchAll(/[“"‘']([^“”"'‘’]{2,80})[”"’']/g),
  ]
    .map((m) => m[1]?.trim())
    .filter(Boolean);

  return Array.from(new Set(matches));
}

function extractNameCandidates(text: string) {
  const matches = [
    ...text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g),
  ]
    .map((m) => m[1]?.trim())
    .filter(Boolean)
    .filter((name) => {
      const blocked = [
        "Amazon MGM",
        "The Studio",
        "The Hollywood Reporter",
        "Prime Video",
        "Disney Plus",
        "White Lotus",
      ];
      return !blocked.includes(name!);
    });

  return Array.from(new Set(matches)).slice(0, 8);
}

function buildRelatedQueries(article: BuzzArticle) {
  const cleanTitle = decodeHtmlEntities(article.title);
  const cleanSummary = decodeHtmlEntities(article.summary);
  const baseText = `${cleanTitle} ${cleanSummary}`;

  const quotedTitles = extractQuotedTitles(baseText);
  const names = extractNameCandidates(baseText);

  const queries: string[] = [];

  for (const q of quotedTitles) queries.push(q);
  for (const q of names) queries.push(q);

  if (queries.length === 0) {
    queries.push(cleanTitle);
  }

  return Array.from(new Set(queries)).slice(0, 6);
}

async function fetchTMDB<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function getArticle(slug: string) {
  const { data } = await supabase
    .from("peekrbuzz_articles")
    .select(
      "id,slug,title,summary,source_name,source_url,image_url,published_at,category,is_published"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  return (data as BuzzArticle | null) ?? null;
}

async function getRelatedContent(article: BuzzArticle, lang: Lang) {
  const apiLang = tmdbLanguage(lang);
  const queries = buildRelatedQueries(article);

  const titleMap = new Map<string, RelatedTitle>();
  const peopleMap = new Map<string, RelatedPerson>();

  for (const query of queries) {
    const [movieSearch, tvSearch, personSearch] = await Promise.all([
      fetchTMDB<{
        results?: Array<{
          id: number;
          title?: string;
          poster_path?: string | null;
        }>;
      }>(
        `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&language=${apiLang}&query=${encodeURIComponent(query)}`
      ),
      fetchTMDB<{
        results?: Array<{
          id: number;
          name?: string;
          poster_path?: string | null;
        }>;
      }>(
        `${TMDB_BASE}/search/tv?api_key=${TMDB_KEY}&language=${apiLang}&query=${encodeURIComponent(query)}`
      ),
      fetchTMDB<{
        results?: Array<{
          id: number;
          name?: string;
          profile_path?: string | null;
        }>;
      }>(
        `${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&language=${apiLang}&query=${encodeURIComponent(query)}`
      ),
    ]);

    for (const item of (movieSearch?.results ?? []).slice(0, 2)) {
      const key = `movie-${item.id}`;
      if (titleMap.has(key)) continue;
      titleMap.set(key, {
        id: item.id,
        media_type: "movie",
        title: item.title || "Untitled",
        image_url: item.poster_path ? `${POSTER}${item.poster_path}` : null,
      });
    }

    for (const item of (tvSearch?.results ?? []).slice(0, 2)) {
      const key = `tv-${item.id}`;
      if (titleMap.has(key)) continue;
      titleMap.set(key, {
        id: item.id,
        media_type: "tv",
        title: item.name || "Untitled",
        image_url: item.poster_path ? `${POSTER}${item.poster_path}` : null,
      });
    }

    for (const item of (personSearch?.results ?? []).slice(0, 2)) {
      const key = `person-${item.id}`;
      if (peopleMap.has(key)) continue;
      peopleMap.set(key, {
        id: item.id,
        name: item.name || "Unknown",
        image_url: item.profile_path ? `${PROFILE}${item.profile_path}` : null,
      });
    }
  }

  return {
    titles: Array.from(titleMap.values()).slice(0, 8),
    people: Array.from(peopleMap.values()).slice(0, 8),
  };
}

function titleHref(item: RelatedTitle) {
  return `/title/${item.media_type}/${item.id}-${slugify(item.title)}`;
}

function actorHref(item: RelatedPerson) {
  return `/actor/${item.id}-${slugify(item.name)}`;
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

function TitlesRow({ items }: { items: RelatedTitle[] }) {
  return (
    <div className="scroll-row">
      {items.map((item) => (
        <Link
          key={`${item.media_type}-${item.id}`}
          href={titleHref(item)}
          className="title-card"
        >
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="title-image" />
          ) : (
            <div className="title-image title-fallback" />
          )}
          <div className="title-name">{decodeHtmlEntities(item.title)}</div>
        </Link>
      ))}
    </div>
  );
}

function PeopleRow({ items }: { items: RelatedPerson[] }) {
  return (
    <div className="scroll-row">
      {items.map((item) => (
        <Link key={item.id} href={actorHref(item)} className="person-card">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="person-image" />
          ) : (
            <div className="person-image person-fallback" />
          )}
          <div className="person-name">{decodeHtmlEntities(item.name)}</div>
        </Link>
      ))}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return {
      title: "PeekrBuzz | Peekr",
      description: "Entertainment news on Peekr.",
    };
  }

  const cleanTitle = decodeHtmlEntities(article.title);
  const cleanSummary = decodeHtmlEntities(article.summary);
  const description = cleanSummary || "Entertainment news on Peekr.";

  return {
    title: `${cleanTitle} | PeekrBuzz`,
    description,
    alternates: {
      canonical: `${SITE}/buzz/${article.slug}`,
    },
    openGraph: {
      title: `${cleanTitle} | PeekrBuzz`,
      description,
      url: `${SITE}/buzz/${article.slug}`,
      siteName: "Peekr",
      type: "article",
      images: article.image_url ? [{ url: article.image_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cleanTitle} | PeekrBuzz`,
      description,
      images: article.image_url ? [article.image_url] : [],
    },
  };
}

export default async function BuzzArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) notFound();

  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      back: "Back to PeekrBuzz",
      readOriginal: "Read original article",
      related: "Related with this article",
      relatedText:
        "People, movies and series that may be connected to this story.",
      relatedTitles: "Related titles",
      relatedPeople: "Related people",
    },
    es: {
      back: "Volver a PeekrBuzz",
      readOriginal: "Leer artículo original",
      related: "Related with this article",
      relatedText:
        "Personas, películas y series que pueden estar conectadas con esta historia.",
      relatedTitles: "Títulos relacionados",
      relatedPeople: "Personas relacionadas",
    },
    pt: {
      back: "Voltar para PeekrBuzz",
      readOriginal: "Ler artigo original",
      related: "Related with this article",
      relatedText:
        "Pessoas, filmes e séries que podem estar conectados com esta história.",
      relatedTitles: "Títulos relacionados",
      relatedPeople: "Pessoas relacionadas",
    },
  }[lang];

  const related = await getRelatedContent(article, lang);
  const cleanTitle = decodeHtmlEntities(article.title);
  const cleanSummary = decodeHtmlEntities(article.summary);

  return (
    <>
      <style>{`
        .buzz-article {
          display: flex;
          flex-direction: column;
          gap: 34px;
        }

        .back-link {
          text-decoration: none;
          color: rgba(255,255,255,0.76);
          font-size: 14px;
          font-weight: 700;
        }

        .hero-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          min-height: 360px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .hero-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .hero-fallback {
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
        }

        .hero-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(10,10,14,0.10) 0%, rgba(10,10,14,0.72) 65%, rgba(10,10,14,0.95) 100%);
        }

        .hero-content {
          position: relative;
          z-index: 1;
          min-height: 360px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .topline {
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

        .hero-content h1 {
          margin: 14px 0 0 0;
          font-size: clamp(30px, 8vw, 54px);
          line-height: 1.03;
          letter-spacing: -0.03em;
          font-weight: 900;
          color: white;
          max-width: 920px;
        }

        .hero-content p {
          margin: 14px 0 0 0;
          max-width: 860px;
          color: rgba(255,255,255,0.82);
          font-size: 16px;
          line-height: 1.8;
        }

        .article-date {
          margin-top: 14px;
          color: rgba(255,255,255,0.60);
          font-size: 12px;
          font-weight: 700;
        }

        .article-body {
          max-width: 860px;
        }

        .article-body p {
          margin: 0;
          color: rgba(255,255,255,0.78);
          font-size: 17px;
          line-height: 1.9;
        }

        .read-original {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border-radius: 16px;
          padding: 14px 18px;
          background: ${BRAND};
          color: white;
          font-weight: 800;
          font-size: 15px;
          margin-top: 20px;
        }

        .section-header h2 {
          margin: 0;
          font-size: clamp(28px, 7vw, 38px);
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

        .scroll-row {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
          margin-top: 16px;
        }

        .title-card,
        .person-card {
          text-decoration: none;
          color: white;
          scroll-snap-align: start;
          flex: 0 0 auto;
        }

        .title-card {
          width: 138px;
          min-width: 138px;
        }

        .title-image,
        .title-fallback {
          width: 138px;
          aspect-ratio: 2 / 3;
          border-radius: 16px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
        }

        .title-name {
          margin-top: 10px;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 700;
          color: rgba(255,255,255,0.95);
        }

        .person-card {
          width: 132px;
          min-width: 132px;
        }

        .person-image,
        .person-fallback {
          width: 132px;
          aspect-ratio: 3 / 4;
          border-radius: 16px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
        }

        .person-name {
          margin-top: 10px;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 700;
          color: rgba(255,255,255,0.95);
        }

        @media (min-width: 900px) {
          .hero-card,
          .hero-content {
            min-height: 430px;
          }

          .hero-content {
            padding: 30px;
          }

          .title-card {
            width: 160px;
            min-width: 160px;
          }

          .title-image,
          .title-fallback {
            width: 160px;
          }

          .person-card {
            width: 150px;
            min-width: 150px;
          }

          .person-image,
          .person-fallback {
            width: 150px;
          }
        }
      `}</style>

      <div className="buzz-article">
        <Link href="/buzz" className="back-link">
          ← {t.back}
        </Link>

        <section className="hero-card">
          {article.image_url ? (
            <img
              src={article.image_url}
              alt={cleanTitle}
              className="hero-image"
            />
          ) : (
            <div className="hero-image hero-fallback" />
          )}
          <div className="hero-overlay" />

          <div className="hero-content">
            <div className="topline">
              {article.category ? (
                <span className="buzz-badge">
                  {categoryLabel(article.category, lang)}
                </span>
              ) : null}
              {article.source_name ? (
                <span className="buzz-source">{article.source_name}</span>
              ) : null}
            </div>

            <h1>{cleanTitle}</h1>

            {cleanSummary ? <p>{cleanSummary}</p> : null}

            <div className="article-date">
              {formatDate(article.published_at, lang)}
            </div>
          </div>
        </section>

        <section className="article-body">
          {cleanSummary ? <p>{cleanSummary}</p> : null}

          {article.source_url ? (
            <a
              href={article.source_url}
              target="_blank"
              rel="noreferrer"
              className="read-original"
            >
              {t.readOriginal}
            </a>
          ) : null}
        </section>

        {(related.titles.length > 0 || related.people.length > 0) ? (
          <section>
            <SectionHeader title={t.related} text={t.relatedText} />

            {related.titles.length > 0 ? (
              <div>
                <SectionHeader title={t.relatedTitles} />
                <TitlesRow items={related.titles} />
              </div>
            ) : null}

            {related.people.length > 0 ? (
              <div style={{ marginTop: 24 }}>
                <SectionHeader title={t.relatedPeople} />
                <PeopleRow items={related.people} />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}}

function decodeHtmlEntities(input?: string | null) {
  if (!input) return "";
  return input
    .replace(/&#8216;|&#8242;|&lsquo;/g, "‘")
    .replace(/&#8217;|&#8243;|&rsquo;/g, "’")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#038;|&#38;|&amp;/g, "&")
    .replace(/&quot;/g, `"`)
    .replace(/&#39;/g, `'`)
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#8230;|&hellip;/g, "…");
}
function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function tmdbLanguage(lang: Lang) {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}

function formatDate(value?: string | null, lang: Lang = "en") {
  if (!value) return "";
  try {
    const locale =
      lang === "es" ? "es-ES" : lang === "pt" ? "pt-BR" : "en-US";

    return new Intl.DateTimeFormat(locale, {
      month: "long",
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
function extractQuotedTitles(text: string) {
  const matches = [
    ...text.matchAll(/[“"‘']([^“”"'‘’]{2,80})[”"’']/g),
  ].map((m) => m[1]?.trim()).filter(Boolean);

  return Array.from(new Set(matches));
}

function extractNameCandidates(text: string) {
  const matches = [
    ...text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g),
  ]
    .map((m) => m[1]?.trim())
    .filter(Boolean)
    .filter((name) => {
      const blocked = [
        "Amazon MGM",
        "The Studio",
        "The Hollywood Reporter",
        "Prime Video",
        "Disney Plus",
        "White Lotus",
      ];
      return !blocked.includes(name!);
    });

  return Array.from(new Set(matches)).slice(0, 8);
}

function buildRelatedQueries(article: BuzzArticle) {
  const baseText = `${article.title} ${article.summary ?? ""}`;

  const quotedTitles = extractQuotedTitles(baseText);
  const names = extractNameCandidates(baseText);

  const queries: string[] = [];

  for (const q of quotedTitles) queries.push(q);
  for (const q of names) queries.push(q);

  if (queries.length === 0) {
    queries.push(article.title);
  }

  return Array.from(new Set(queries)).slice(0, 6);
}
async function fetchTMDB<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function getArticle(slug: string) {
  const { data } = await supabase
    .from("peekrbuzz_articles")
    .select(
      "id,slug,title,summary,source_name,source_url,image_url,published_at,category,is_published"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  return (data as BuzzArticle | null) ?? null;
}

async function getRelatedContent(article: BuzzArticle, lang: Lang) {
  const apiLang = tmdbLanguage(lang);
  const queries = buildRelatedQueries(article);

  const titleMap = new Map<string, RelatedTitle>();
  const peopleMap = new Map<string, RelatedPerson>();

  for (const query of queries) {
    const [movieSearch, tvSearch, personSearch] = await Promise.all([
      fetchTMDB<{
        results?: Array<{
          id: number;
          title?: string;
          poster_path?: string | null;
        }>;
      }>(
        `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&language=${apiLang}&query=${encodeURIComponent(query)}`
      ),
      fetchTMDB<{
        results?: Array<{
          id: number;
          name?: string;
          poster_path?: string | null;
        }>;
      }>(
        `${TMDB_BASE}/search/tv?api_key=${TMDB_KEY}&language=${apiLang}&query=${encodeURIComponent(query)}`
      ),
      fetchTMDB<{
        results?: Array<{
          id: number;
          name?: string;
          profile_path?: string | null;
        }>;
      }>(
        `${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&language=${apiLang}&query=${encodeURIComponent(query)}`
      ),
    ]);

    for (const item of (movieSearch?.results ?? []).slice(0, 2)) {
      const key = `movie-${item.id}`;
      if (titleMap.has(key)) continue;
      titleMap.set(key, {
        id: item.id,
        media_type: "movie",
        title: item.title || "Untitled",
        image_url: item.poster_path ? `${POSTER}${item.poster_path}` : null,
      });
    }

    for (const item of (tvSearch?.results ?? []).slice(0, 2)) {
      const key = `tv-${item.id}`;
      if (titleMap.has(key)) continue;
      titleMap.set(key, {
        id: item.id,
        media_type: "tv",
        title: item.name || "Untitled",
        image_url: item.poster_path ? `${POSTER}${item.poster_path}` : null,
      });
    }

    for (const item of (personSearch?.results ?? []).slice(0, 2)) {
      const key = `person-${item.id}`;
      if (peopleMap.has(key)) continue;
      peopleMap.set(key, {
        id: item.id,
        name: item.name || "Unknown",
        image_url: item.profile_path ? `${PROFILE}${item.profile_path}` : null,
      });
    }
  }

  return {
    titles: Array.from(titleMap.values()).slice(0, 8),
    people: Array.from(peopleMap.values()).slice(0, 8),
  };
}
function titleHref(item: RelatedTitle) {
  return `/title/${item.media_type}/${item.id}-${slugify(item.title)}`;
}

function actorHref(item: RelatedPerson) {
  return `/actor/${item.id}-${slugify(item.name)}`;
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

function TitlesRow({ items }: { items: RelatedTitle[] }) {
  return (
    <div className="scroll-row">
      {items.map((item) => (
        <Link key={`${item.media_type}-${item.id}`} href={titleHref(item)} className="title-card">
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="title-image" />
          ) : (
            <div className="title-image title-fallback" />
          )}
          <div className="title-name">{item.title}</div>
        </Link>
      ))}
    </div>
  );
}

function PeopleRow({ items }: { items: RelatedPerson[] }) {
  return (
    <div className="scroll-row">
      {items.map((item) => (
        <Link key={item.id} href={actorHref(item)} className="person-card">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="person-image" />
          ) : (
            <div className="person-image person-fallback" />
          )}
          <div className="person-name">{item.name}</div>
        </Link>
      ))}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return {
      title: "PeekrBuzz | Peekr",
      description: "Entertainment news on Peekr.",
    };
  }

  const description =
    article.summary ||
    "Entertainment news on Peekr.";

  return {
    title: `${article.title} | PeekrBuzz`,
    description,
    alternates: {
      canonical: `${SITE}/buzz/${article.slug}`,
    },
    openGraph: {
      title: `${article.title} | PeekrBuzz`,
      description,
      url: `${SITE}/buzz/${article.slug}`,
      siteName: "Peekr",
      type: "article",
      images: article.image_url
        ? [{ url: article.image_url }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} | PeekrBuzz`,
      description,
      images: article.image_url ? [article.image_url] : [],
    },
  };
}

export default async function BuzzArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) notFound();

  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      back: "Back to PeekrBuzz",
      readOriginal: "Read original article",
      related: "Related with this article",
      relatedText:
        "People, movies and series that may be connected to this story.",
      relatedTitles: "Related titles",
      relatedPeople: "Related people",
    },
    es: {
      back: "Volver a PeekrBuzz",
      readOriginal: "Leer artículo original",
      related: "Related with this article",
      relatedText:
        "Personas, películas y series que pueden estar conectadas con esta historia.",
      relatedTitles: "Títulos relacionados",
      relatedPeople: "Personas relacionadas",
    },
    pt: {
      back: "Voltar para PeekrBuzz",
      readOriginal: "Ler artigo original",
      related: "Related with this article",
      relatedText:
        "Pessoas, filmes e séries que podem estar conectados com esta história.",
      relatedTitles: "Títulos relacionados",
      relatedPeople: "Pessoas relacionadas",
    },
  }[lang];

  const related = await getRelatedContent(article, lang);

  return (
    <>
      <style>{`
        .buzz-article {
          display: flex;
          flex-direction: column;
          gap: 34px;
        }

        .back-link {
          text-decoration: none;
          color: rgba(255,255,255,0.76);
          font-size: 14px;
          font-weight: 700;
        }

        .hero-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          min-height: 360px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .hero-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .hero-fallback {
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
        }

        .hero-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(10,10,14,0.10) 0%, rgba(10,10,14,0.72) 65%, rgba(10,10,14,0.95) 100%);
        }

        .hero-content {
          position: relative;
          z-index: 1;
          min-height: 360px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .topline {
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

        .hero-content h1 {
          margin: 14px 0 0 0;
          font-size: clamp(30px, 8vw, 54px);
          line-height: 1.03;
          letter-spacing: -0.03em;
          font-weight: 900;
          color: white;
          max-width: 920px;
        }

        .hero-content p {
          margin: 14px 0 0 0;
          max-width: 860px;
          color: rgba(255,255,255,0.82);
          font-size: 16px;
          line-height: 1.8;
        }

        .article-date {
          margin-top: 14px;
          color: rgba(255,255,255,0.60);
          font-size: 12px;
          font-weight: 700;
        }

        .article-body {
          max-width: 860px;
        }

        .article-body p {
          margin: 0;
          color: rgba(255,255,255,0.78);
          font-size: 17px;
          line-height: 1.9;
        }

        .read-original {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border-radius: 16px;
          padding: 14px 18px;
          background: ${BRAND};
          color: white;
          font-weight: 800;
          font-size: 15px;
          margin-top: 20px;
        }

        .section-header h2 {
          margin: 0;
          font-size: clamp(28px, 7vw, 38px);
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

        .scroll-row {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
          margin-top: 16px;
        }

        .title-card,
        .person-card {
          text-decoration: none;
          color: white;
          scroll-snap-align: start;
          flex: 0 0 auto;
        }

        .title-card {
          width: 138px;
          min-width: 138px;
        }

        .title-image,
        .title-fallback {
          width: 138px;
          aspect-ratio: 2 / 3;
          border-radius: 16px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
        }

        .title-name {
          margin-top: 10px;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 700;
          color: rgba(255,255,255,0.95);
        }

        .person-card {
          width: 132px;
          min-width: 132px;
        }

        .person-image,
        .person-fallback {
          width: 132px;
          aspect-ratio: 3 / 4;
          border-radius: 16px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
        }

        .person-name {
          margin-top: 10px;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 700;
          color: rgba(255,255,255,0.95);
        }

        @media (min-width: 900px) {
          .hero-card,
          .hero-content {
            min-height: 430px;
          }

          .hero-content {
            padding: 30px;
          }

          .title-card {
            width: 160px;
            min-width: 160px;
          }

          .title-image,
          .title-fallback {
            width: 160px;
          }

          .person-card {
            width: 150px;
            min-width: 150px;
          }

          .person-image,
          .person-fallback {
            width: 150px;
          }
        }
      `}</style>

      <div className="buzz-article">
        <Link href="/buzz" className="back-link">
          ← {t.back}
        </Link>

        <section className="hero-card">
          {article.image_url ? (
            <img
              src={article.image_url}
              alt={article.title}
              className="hero-image"
            />
          ) : (
            <div className="hero-image hero-fallback" />
          )}
          <div className="hero-overlay" />

          <div className="hero-content">
            <div className="topline">
              {article.category ? (
                <span className="buzz-badge">
                  {categoryLabel(article.category, lang)}
                </span>
              ) : null}
              {article.source_name ? (
                <span className="buzz-source">{article.source_name}</span>
              ) : null}
            </div>

            <h1>{article.title}</h1>

            {article.summary ? <p>{article.summary}</p> : null}

            <div className="article-date">
              {formatDate(article.published_at, lang)}
            </div>
          </div>
        </section>

        <section className="article-body">
          {article.summary ? <p>{article.summary}</p> : null}

          {article.source_url ? (
            <a
              href={article.source_url}
              target="_blank"
              rel="noreferrer"
              className="read-original"
            >
              {t.readOriginal}
            </a>
          ) : null}
        </section>

        {(related.titles.length > 0 || related.people.length > 0) ? (
          <section>
            <SectionHeader title={t.related} text={t.relatedText} />

            {related.titles.length > 0 ? (
              <div>
                <SectionHeader title={t.relatedTitles} />
                <TitlesRow items={related.titles} />
              </div>
            ) : null}

            {related.people.length > 0 ? (
              <div style={{ marginTop: 24 }}>
                <SectionHeader title={t.relatedPeople} />
                <PeopleRow items={related.people} />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
