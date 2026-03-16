export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w342";
const BACKDROP = "https://image.tmdb.org/t/p/w780";
const BRAND = "#FA0082";
const SITE = "https://www.peekr.app";

type Lang = "en" | "es" | "pt";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type EditorialCollection = {
  slug: string;
  title_en: string;
  title_es: string;
  title_pt: string;
  description_en: string | null;
  description_es: string | null;
  description_pt: string | null;
  cover_url: string | null;
  category: string | null;
  is_published: boolean;
  sort_order: number;
};

type EditorialCollectionItem = {
  tmdb_id: number;
  media_type: string;
  position: number;
};

type HydratedTitle = {
  tmdb_id: number;
  media_type: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  first_air_date: string | null;
  overview: string | null;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
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

function titleHref(item: {
  tmdb_id: number;
  media_type: string;
  title: string;
}) {
  const type = item.media_type === "tv" ? "tv" : "movie";
  return `/title/${type}/${item.tmdb_id}-${slugify(item.title)}`;
}

function getYear(item: {
  release_date?: string | null;
  first_air_date?: string | null;
}) {
  const raw = item.release_date || item.first_air_date || "";
  return raw ? raw.slice(0, 4) : "";
}

function getStrings(lang: Lang) {
  return {
    en: {
      back: "Back to Peeklists",
      items: "Titles",
      openInApp: "Open in app",
      empty: "This collection has no titles yet.",
      untitled: "Untitled collection",
      fallbackDescription:
        "A curated editorial collection built for movie and series discovery on Peekr.",
      category: "Category",
      updated: "Editorial collection",
    },
    es: {
      back: "Volver a Peeklists",
      items: "Títulos",
      openInApp: "Abrir en app",
      empty: "Esta colección todavía no tiene títulos.",
      untitled: "Colección sin título",
      fallbackDescription:
        "Una colección editorial curada para descubrir películas y series en Peekr.",
      category: "Categoría",
      updated: "Colección editorial",
    },
    pt: {
      back: "Voltar para Peeklists",
      items: "Títulos",
      openInApp: "Abrir no app",
      empty: "Esta coleção ainda não tem títulos.",
      untitled: "Coleção sem título",
      fallbackDescription:
        "Uma coleção editorial curada para descobrir filmes e séries no Peekr.",
      category: "Categoria",
      updated: "Coleção editorial",
    },
  }[lang];
}

function localizedTitle(row: EditorialCollection, lang: Lang) {
  if (lang === "es") return row.title_es || row.title_en || row.title_pt;
  if (lang === "pt") return row.title_pt || row.title_en || row.title_es;
  return row.title_en || row.title_es || row.title_pt;
}

function localizedDescription(row: EditorialCollection, lang: Lang) {
  if (lang === "es") return row.description_es || row.description_en || row.description_pt;
  if (lang === "pt") return row.description_pt || row.description_en || row.description_es;
  return row.description_en || row.description_es || row.description_pt;
}

async function getCollection(slug: string) {
  const { data } = await supabase
    .from("editorial_collections")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  return (data as EditorialCollection | null) ?? null;
}

async function getCollectionItems(slug: string) {
  const { data } = await supabase
    .from("editorial_collection_items")
    .select("tmdb_id,media_type,position")
    .eq("collection_slug", slug)
    .order("position", { ascending: true });

  return (data as EditorialCollectionItem[] | null) ?? [];
}

async function hydrateTitles(items: EditorialCollectionItem[], lang: Lang) {
  const apiLang = tmdbLanguage(lang);

  const hydrated = await Promise.all(
    items.map(async (item) => {
      try {
        const type = item.media_type === "tv" ? "tv" : "movie";
        const res = await fetch(
          `${TMDB_BASE}/${type}/${item.tmdb_id}?api_key=${TMDB_KEY}&language=${apiLang}`,
          { next: { revalidate: 3600 } }
        );

        if (!res.ok) return null;

        const json = await res.json();

        return {
          tmdb_id: item.tmdb_id,
          media_type: type,
          title: json.title || json.name || "Untitled",
          poster_path: json.poster_path || null,
          backdrop_path: json.backdrop_path || null,
          release_date: json.release_date || null,
          first_air_date: json.first_air_date || null,
          overview: json.overview || null,
        } as HydratedTitle;
      } catch {
        return null;
      }
    })
  );

  return hydrated.filter(Boolean) as HydratedTitle[];
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);
  const t = getStrings(lang);

  const collection = await getCollection(slug);

  if (!collection) {
    return {
      title: "Peeklists | Peekr",
      description: "Editorial collections on Peekr.",
    };
  }

  const title = localizedTitle(collection, lang) || t.untitled;
  const description = localizedDescription(collection, lang) || t.fallbackDescription;

  return {
    title: `${title} | Peekr`,
    description,
    alternates: {
      canonical: `${SITE}/lists/${slug}`,
    },
    openGraph: {
      title: `${title} | Peekr`,
      description,
      url: `${SITE}/lists/${slug}`,
      siteName: "Peekr",
      type: "website",
      images: collection.cover_url ? [{ url: collection.cover_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Peekr`,
      description,
    },
  };
}

export default async function EditorialCollectionPage({ params }: PageProps) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);
  const t = getStrings(lang);

  const collection = await getCollection(slug);
  if (!collection) notFound();

  const itemsRaw = await getCollectionItems(slug);
  const items = await hydrateTitles(itemsRaw, lang);

  const title = localizedTitle(collection, lang) || t.untitled;
  const description = localizedDescription(collection, lang) || t.fallbackDescription;
  const heroImage = collection.cover_url || items[0]?.backdrop_path
    ? collection.cover_url || `${BACKDROP}${items[0]?.backdrop_path}`
    : null;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE}${titleHref(item)}`,
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
        .collection-page {
          display: flex;
          flex-direction: column;
          gap: 34px;
        }

        .collection-back {
          display: inline-flex;
          width: fit-content;
          color: rgba(255,255,255,0.72);
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
        }

        .collection-hero {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }

        .collection-cover-wrap {
          width: 100%;
          max-width: 560px;
        }

        .collection-cover,
        .collection-cover-fallback {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 24px;
          object-fit: cover;
          display: block;
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
          border: 1px solid rgba(255,255,255,0.08);
        }

        .collection-copy h1 {
          margin: 0;
          font-size: clamp(40px, 9vw, 68px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
        }

        .collection-copy p {
          margin: 16px 0 0 0;
          max-width: 760px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .collection-meta {
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
          .collection-hero {
            grid-template-columns: 480px 1fr;
            gap: 30px;
          }

          .titles-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 18px;
          }
        }
      `}</style>

      <div className="collection-page">
        <Link href="/lists" className="collection-back">
          ← {t.back}
        </Link>

        <section className="collection-hero">
          <div className="collection-cover-wrap">
            {heroImage ? (
              <img
                src={heroImage}
                alt={title}
                className="collection-cover"
              />
            ) : (
              <div className="collection-cover-fallback" />
            )}
          </div>

          <div className="collection-copy">
            <h1>{title}</h1>

            <p>{description}</p>

            <div className="collection-meta">
              <div className="meta-pill">
                {items.length} {t.items}
              </div>
              {collection.category ? (
                <div className="meta-pill">
                  {t.category}: {collection.category}
                </div>
              ) : null}
              <div className="meta-pill">{t.updated}</div>
            </div>

            <div className="hero-actions">
              <Link href="/download-app" className="btn-primary">
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
                  href={titleHref(item)}
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
                      {getYear(item) ? ` · ${getYear(item)}` : ""}
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
