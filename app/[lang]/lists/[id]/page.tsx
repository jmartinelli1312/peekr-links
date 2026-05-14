export const revalidate = 604800; // 7 days — curated lists rarely change

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const BRAND = "#FA0082";
const POSTER = "https://image.tmdb.org/t/p/w342";
const BACKDROP = "https://image.tmdb.org/t/p/w780";
const SITE = "https://www.peekr.app";

type Lang = "en" | "es" | "pt";

type PageProps = {
  params: Promise<{
    lang: string;
    id: string;
  }>;
};

type EditorialCollectionRow = {
  slug: string;
  title_en: string | null;
  title_es: string | null;
  title_pt: string | null;
  description_en: string | null;
  description_es: string | null;
  description_pt: string | null;
  cover_url: string | null;
  category: string | null;
  source_type: string | null;
  is_published: boolean;
  item_count: number | null;
};

type EditorialCollectionItemRow = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  position: number | null;
};

type TmdbTitle = {
  id: number;
  title?: string | null;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
};

type HydratedItem = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  position: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "es").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("pt")) return "pt";
  return "es";
}

function tmdbLanguage(lang: Lang) {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
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

function localizedTitle(row: EditorialCollectionRow, lang: Lang) {
  if (lang === "es") return row.title_es || row.title_en || row.title_pt || "";
  if (lang === "pt") return row.title_pt || row.title_en || row.title_es || "";
  return row.title_en || row.title_es || row.title_pt || "";
}

function localizedDescription(row: EditorialCollectionRow, lang: Lang) {
  if (lang === "es") {
    return row.description_es || row.description_en || row.description_pt || "";
  }
  if (lang === "pt") {
    return row.description_pt || row.description_en || row.description_es || "";
  }
  return row.description_en || row.description_es || row.description_pt || "";
}

function titleHref(
  lang: Lang,
  item: {
    tmdb_id: number;
    media_type?: string | null;
    title?: string | null;
    name?: string | null;
  }
) {
  const type = item.media_type === "tv" ? "tv" : "movie";
  const rawTitle = item.title || item.name || "title";
  return `/${lang}/title/${type}/${item.tmdb_id}-${slugify(rawTitle)}`;
}

function categoryLabel(category?: string | null, lang: Lang = "es") {
  const map = {
    en: {
      awards: "Awards",
      curated: "Curated",
      regional: "Regional",
      trending: "Trending",
    },
    es: {
      awards: "Premios",
      curated: "Curada",
      regional: "Regional",
      trending: "Trending",
    },
    pt: {
      awards: "Prêmios",
      curated: "Curada",
      regional: "Regional",
      trending: "Trending",
    },
  }[lang];

  return map[(category as keyof typeof map) || "curated"] || category || "";
}

function getStrings(lang: Lang) {
  return {
    en: {
      backToLists: "Back to Peeklists",
      openInApp: "Open in app",
      items: "Titles",
      empty: "This list has no titles yet.",
      untitled: "Untitled list",
      noDescription:
        "A curated list to discover movies and series on Peekr.",
    },
    es: {
      backToLists: "Volver a Peeklists",
      openInApp: "Abrir en app",
      items: "Títulos",
      empty: "Esta lista todavía no tiene títulos.",
      untitled: "Lista sin título",
      noDescription:
        "Una lista curada para descubrir películas y series en Peekr.",
    },
    pt: {
      backToLists: "Voltar para Peeklists",
      openInApp: "Abrir no app",
      items: "Títulos",
      empty: "Esta lista ainda não tem títulos.",
      untitled: "Lista sem título",
      noDescription:
        "Uma lista curada para descobrir filmes e séries no Peekr.",
    },
  }[lang];
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

async function getEditorialCollection(id: string) {
  try {
    const { data } = await supabase
      .from("editorial_collections")
      .select(
        "slug,title_en,title_es,title_pt,description_en,description_es,description_pt,cover_url,category,source_type,is_published,item_count"
      )
      .eq("slug", id)
      .eq("is_published", true)
      .maybeSingle();

    return (data as EditorialCollectionRow | null) ?? null;
  } catch {
    return null;
  }
}

async function getEditorialCollectionItems(id: string, lang: Lang) {
  try {
    const { data } = await supabase
      .from("editorial_collection_items")
      .select("tmdb_id,media_type,position")
      .eq("collection_slug", id)
      .order("position", { ascending: true });

    const rows = ((data as EditorialCollectionItemRow[] | null) ?? []).filter(
      (item) => !!item.tmdb_id
    );

    const apiLang = tmdbLanguage(lang);

    const hydrated = await Promise.all(
      rows.map(async (item, index) => {
        const type = item.media_type === "tv" ? "tv" : "movie";

        const detail = await fetchTMDB<TmdbTitle>(
          `${TMDB_BASE}/${type}/${item.tmdb_id}?api_key=${TMDB_KEY}&language=${apiLang}`
        );

        return {
          tmdb_id: item.tmdb_id,
          media_type: type,
          position: item.position ?? index + 1,
          title: detail?.title || detail?.name || "Untitled",
          poster_path: detail?.poster_path || null,
          backdrop_path: detail?.backdrop_path || null,
        } satisfies HydratedItem;
      })
    );

    return hydrated;
  } catch {
    return [];
  }
}

async function getBackdropFromFirstItem(id: string, lang: Lang) {
  const items = await getEditorialCollectionItems(id, lang);
  const first = items[0];
  if (!first) return null;

  const apiLang = tmdbLanguage(lang);
  const detail = await fetchTMDB<TmdbTitle>(
    `${TMDB_BASE}/${first.media_type}/${first.tmdb_id}?api_key=${TMDB_KEY}&language=${apiLang}`
  );

  return detail?.backdrop_path ? `${BACKDROP}${detail.backdrop_path}` : null;
}

export async function generateMetadata({ params }: PageProps) {
  const { lang: rawLang, id } = await params;
  const lang = normalizeLang(rawLang);
  const t = getStrings(lang);

  const collection = await getEditorialCollection(id);

  if (!collection) {
    return {
      title: "Peeklists | Peekr",
      description: "Discover curated lists on Peekr.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = localizedTitle(collection, lang) || t.untitled;
  const description = localizedDescription(collection, lang) || t.noDescription;
  const canonical = `${SITE}/${lang}/lists/${collection.slug}`;

  return {
    title: `${title} | Peekr`,
    description,
    alternates: {
      canonical,
      languages: {
        es: `${SITE}/es/lists/${collection.slug}`,
        en: `${SITE}/en/lists/${collection.slug}`,
        pt: `${SITE}/pt/lists/${collection.slug}`,
        "x-default": `${SITE}/es/lists/${collection.slug}`,
      },
    },
    openGraph: {
      title: `${title} | Peekr`,
      description,
      url: canonical,
      siteName: "Peekr",
      type: "website",
      images: collection.cover_url ? [{ url: collection.cover_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Peekr`,
      description,
      images: collection.cover_url ? [collection.cover_url] : [],
    },
  };
}

export default async function EditorialListDetailPage({ params }: PageProps) {
  const { lang: rawLang, id } = await params;
  const lang = normalizeLang(rawLang);
  const t = getStrings(lang);

  const collection = await getEditorialCollection(id);
  if (!collection) notFound();

  if (id !== collection.slug) {
    redirect(`/${lang}/lists/${collection.slug}`);
  }

  const items = await getEditorialCollectionItems(collection.slug, lang);

  // Derive backdrop from first item — no extra fetch needed since items are already hydrated
  const fallbackBackdrop = !collection.cover_url && items[0]?.backdrop_path
    ? `${BACKDROP}${items[0].backdrop_path}`
    : null;

  const title = localizedTitle(collection, lang) || t.untitled;
  const description = localizedDescription(collection, lang) || t.noDescription;
  const heroImage = collection.cover_url || fallbackBackdrop;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE}${titleHref(lang, item)}`,
      name: item.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <style>{`
        .peeklist-page {
          display: flex;
          flex-direction: column;
          gap: 34px;
        }

        .peeklist-back {
          display: inline-flex;
          width: fit-content;
          color: rgba(255,255,255,0.72);
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
        }

        .peeklist-hero {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }

        .peeklist-cover-wrap {
          width: 100%;
          max-width: 520px;
        }

        .peeklist-cover,
        .peeklist-cover-fallback {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 24px;
          object-fit: cover;
          display: block;
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
          border: 1px solid rgba(255,255,255,0.08);
        }

        .peeklist-copy h1 {
          margin: 0;
          font-size: clamp(40px, 9vw, 68px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
        }

        .peeklist-copy p {
          margin: 16px 0 0 0;
          max-width: 760px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .peeklist-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
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

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .btn-primary {
          text-decoration: none;
          border-radius: 16px;
          padding: 14px 18px;
          font-weight: 800;
          font-size: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${BRAND};
          color: white;
        }

        .section h2 {
          margin: 0 0 18px 0;
          font-size: clamp(30px, 7vw, 38px);
          line-height: 1.02;
          color: white;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .titles-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .title-card {
          text-decoration: none;
          color: white;
        }

        .title-poster,
        .title-poster-fallback {
          width: 100%;
          aspect-ratio: 2 / 3;
          border-radius: 16px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
        }

        .title-meta {
          margin-top: 10px;
        }

        .title-name {
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
          color: rgba(255,255,255,0.96);
        }

        .title-sub {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255,255,255,0.56);
        }

        .empty-state {
          min-height: 220px;
          display: grid;
          place-items: center;
          color: rgba(255,255,255,0.56);
          text-align: center;
        }

        @media (min-width: 900px) {
          .peeklist-hero {
            grid-template-columns: 460px 1fr;
            gap: 30px;
          }

          .titles-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 18px;
          }
        }
      `}</style>

      <div className="peeklist-page">
        <Link href={`/${lang}/lists`} className="peeklist-back">
          ← {t.backToLists}
        </Link>

        <section className="peeklist-hero">
          <div className="peeklist-cover-wrap">
            {heroImage ? (
              <img
                src={heroImage}
                alt={title}
                className="peeklist-cover"
              />
            ) : (
              <div className="peeklist-cover-fallback" />
            )}
          </div>

          <div className="peeklist-copy">
            <h1>{title}</h1>

            <p>{description}</p>

            <div className="peeklist-meta">
              <div className="meta-pill">
                {items.length} {t.items}
              </div>

              {collection.category ? (
                <div className="meta-pill">
                  {categoryLabel(collection.category, lang)}
                </div>
              ) : null}
            </div>

            <div className="hero-actions">
              <Link href={`/${lang}/signup`} className="btn-primary">
                {t.openInApp}
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>{t.items}</h2>

          {items.length === 0 ? (
            <div className="empty-state">{t.empty}</div>
          ) : (
            <div className="titles-grid">
              {items.map((item, index) => (
                <Link
                  key={`${item.tmdb_id}-${index}`}
                  href={titleHref(lang, item)}
                  className="title-card"
                >
                  {item.poster_path ? (
                    <img
                      src={`${POSTER}${item.poster_path}`}
                      alt={item.title}
                      className="title-poster"
                    />
                  ) : (
                    <div className="title-poster-fallback" />
                  )}

                  <div className="title-meta">
                    <div className="title-name">{item.title}</div>
                    <div className="title-sub">
                      {item.media_type === "tv" ? "TV" : "Movie"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
