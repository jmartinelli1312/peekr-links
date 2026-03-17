export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const BACKDROP = "https://image.tmdb.org/t/p/w780";
const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

type PeeklistItem = {
  id: string | number;
  title?: string | null;
  cover_url?: string | null;
};

type EditorialCollection = {
  slug: string;
  title_en: string;
  title_es: string;
  title_pt: string;
  description_en?: string | null;
  description_es?: string | null;
  description_pt?: string | null;
  cover_url?: string | null;
  category?: string | null;
  source_type?: string | null;
  is_published: boolean;
  sort_order: number;
  item_count?: number | null;
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

function localizedCollectionTitle(item: EditorialCollection, lang: Lang) {
  if (lang === "es") return item.title_es || item.title_en || item.title_pt;
  if (lang === "pt") return item.title_pt || item.title_en || item.title_es;
  return item.title_en || item.title_es || item.title_pt;
}

async function fetchBackdropForCollection(
  slug: string,
  lang: Lang
): Promise<string | null> {
  const { data: firstItem } = await supabase
    .from("editorial_collection_items")
    .select("tmdb_id,media_type,position")
    .eq("collection_slug", slug)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstItem?.tmdb_id) return null;

  try {
    const type = firstItem.media_type === "tv" ? "tv" : "movie";
    const apiLang = tmdbLanguage(lang);

    const res = await fetch(
      `${TMDB_BASE}/${type}/${firstItem.tmdb_id}?api_key=${TMDB_KEY}&language=${apiLang}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return null;

    const json = await res.json();
    return json.backdrop_path ? `${BACKDROP}${json.backdrop_path}` : null;
  } catch {
    return null;
  }
}

async function collectionToPeeklistItem(
  item: EditorialCollection,
  lang: Lang
): Promise<PeeklistItem> {
  const fallbackCover = item.cover_url
    ? item.cover_url
    : await fetchBackdropForCollection(item.slug, lang);

  return {
    id: item.slug,
    title: localizedCollectionTitle(item, lang),
    cover_url: fallbackCover ?? null,
  };
}

async function getCollectionsByCategory(
  categories: string[],
  lang: Lang,
  limit = 24
) {
  const { data } = await supabase
    .from("editorial_collections")
    .select(
      "slug,title_en,title_es,title_pt,description_en,description_es,description_pt,cover_url,category,source_type,is_published,sort_order,item_count"
    )
    .eq("is_published", true)
    .in("category", categories)
    .order("sort_order", { ascending: true })
    .limit(limit);

  const rows = ((data as EditorialCollection[] | null) ?? []).filter(
    (item) => (item.item_count ?? 0) > 0
  );

  return await Promise.all(rows.map((item) => collectionToPeeklistItem(item, lang)));
}

async function getCollectionsBySourceType(
  sourceTypes: string[],
  lang: Lang,
  limit = 24
) {
  const { data } = await supabase
    .from("editorial_collections")
    .select(
      "slug,title_en,title_es,title_pt,description_en,description_es,description_pt,cover_url,category,source_type,is_published,sort_order,item_count"
    )
    .eq("is_published", true)
    .in("source_type", sourceTypes)
    .order("sort_order", { ascending: true })
    .limit(limit);

  const rows = ((data as EditorialCollection[] | null) ?? []).filter(
    (item) => (item.item_count ?? 0) > 0
  );

  return await Promise.all(rows.map((item) => collectionToPeeklistItem(item, lang)));
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

function PeeklistsRow({
  items,
  hrefPrefix = "/lists",
}: {
  items: PeeklistItem[];
  hrefPrefix?: string;
}) {
  return (
    <div className="peeklists-row">
      {items.map((pl) => (
        <Link
          key={String(pl.id)}
          href={`${hrefPrefix}/${pl.id}`}
          className="peeklist-card"
        >
          {pl.cover_url ? (
            <img
              src={pl.cover_url}
              alt={pl.title || "Peeklist"}
              className="peeklist-cover"
            />
          ) : (
            <div className="peeklist-fallback" />
          )}

          <div className="peeklist-meta">
            <div className="peeklist-title">{pl.title || "Peeklist"}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export async function generateMetadata() {
  return {
    title: "Peeklists | Peekr",
    description:
      "Discover award winners, curated collections, streaming picks, people-based lists and trending movie and TV collections on Peekr.",
    alternates: {
      canonical: "https://www.peekr.app/lists",
    },
    openGraph: {
      title: "Peeklists | Peekr",
      description:
        "Discover award winners, curated collections, streaming picks, people-based lists and trending movie and TV collections on Peekr.",
      url: "https://www.peekr.app/lists",
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Peeklists | Peekr",
      description:
        "Discover award winners, curated collections, streaming picks, people-based lists and trending movie and TV collections on Peekr.",
    },
  };
}

export default async function ListsPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      title: "Peeklists",
      subtitle:
        "Discover award winners, curated collections, streaming picks, people-based lists and what is trending right now.",
      awardsTitle: "Award winners",
      awardsText: "Oscars, Emmys, Golden Globes, BAFTA and festival winners.",
      curatedTitle: "Curated collections",
      curatedText: "Handpicked lists built for discovery, and taste.",
      regionalTitle: "Regional picks",
      regionalText: "Collections tailored to Latin America and local taste.",
      platformTitle: "By platform",
      platformText: "Recent releases grouped by streaming platform.",
      peopleTitle: "Popular people picks",
      peopleText: "Best titles with actors and best movies by directors.",
      trendingTitle: "Trending now",
      trendingText: "Strictly filtered trending collections by category.",
    },
    es: {
      title: "Peeklists",
      subtitle:
        "Descubre ganadores de premios, listas curadas, picks por plataforma, listas por personas y lo que está en tendencia ahora.",
      awardsTitle: "Ganadores de premios",
      awardsText: "Oscars, Emmys, Golden Globes, BAFTA y ganadores de festivales.",
      curatedTitle: "Listas curadas",
      curatedText: "Listas elegidas a mano para discovery, y gusto.",
      regionalTitle: "Selecciones regionales",
      regionalText: "Colecciones pensadas para LATAM y el gusto local.",
      platformTitle: "Por plataforma",
      platformText: "Estrenos recientes agrupados por plataforma.",
      peopleTitle: "Títulos por personas populares",
      peopleText: "Mejores títulos con actores y mejores películas de directores.",
      trendingTitle: "En tendencia ahora",
      trendingText: "Colecciones trending con filtros estrictos por categoría.",
    },
    pt: {
      title: "Peeklists",
      subtitle:
        "Descubra vencedores de prêmios, listas curadas, picks por plataforma, listas por pessoas e o que está em alta agora.",
      awardsTitle: "Vencedores de prêmios",
      awardsText: "Oscars, Emmys, Golden Globes, BAFTA e vencedores de festivais.",
      curatedTitle: "Listas curadas",
      curatedText: "Listas escolhidas à mão para discovery, e gosto.",
      regionalTitle: "Seleções regionais",
      regionalText: "Coleções pensadas para LATAM e gosto local.",
      platformTitle: "Por plataforma",
      platformText: "Lançamentos recentes agrupados por plataforma.",
      peopleTitle: "Títulos por pessoas populares",
      peopleText: "Melhores títulos com atores e melhores filmes de diretores.",
      trendingTitle: "Em alta agora",
      trendingText: "Coleções em alta com filtros estritos por categoria.",
    },
  }[lang];

  const [
    awards,
    curated,
    regional,
    platform,
    people,
    trending,
  ] = await Promise.all([
    getCollectionsByCategory(["awards"], lang, 24),
    getCollectionsByCategory(["curated"], lang, 40),
    getCollectionsByCategory(["regional"], lang, 20),
    getCollectionsBySourceType(["platform_releases"], lang, 16),
    getCollectionsBySourceType(
      ["popular_actor_titles", "popular_director_titles"],
      lang,
      48
    ),
    getCollectionsBySourceType(["trend_driven"], lang, 16),
  ]);

  return (
    <>
      <style>{`
        .lists-page {
          display: flex;
          flex-direction: column;
          gap: 56px;
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
          max-width: 820px;
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

        .peeklists-row {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }

        .peeklist-card {
          width: 260px;
          min-width: 260px;
          text-decoration: none;
          color: white;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          overflow: hidden;
          scroll-snap-align: start;
        }

        .peeklist-cover,
        .peeklist-fallback {
          width: 100%;
          height: 150px;
          object-fit: cover;
          display: block;
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
        }

        .peeklist-meta {
          padding: 14px;
        }

        .peeklist-title {
          font-size: 14px;
          font-weight: 700;
          line-height: 1.45;
          color: rgba(255,255,255,0.96);
        }

        @media (min-width: 900px) {
          .lists-page {
            gap: 72px;
          }

          .peeklist-card {
            width: 300px;
            min-width: 300px;
          }

          .peeklist-cover,
          .peeklist-fallback {
            height: 170px;
          }
        }
      `}</style>

      <div className="lists-page">
        <section className="hero">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </section>

        {awards.length > 0 ? (
          <section>
            <SectionHeader title={t.awardsTitle} text={t.awardsText} />
            <PeeklistsRow items={awards} />
          </section>
        ) : null}

        {curated.length > 0 ? (
          <section>
            <SectionHeader title={t.curatedTitle} text={t.curatedText} />
            <PeeklistsRow items={curated} />
          </section>
        ) : null}

        {regional.length > 0 ? (
          <section>
            <SectionHeader title={t.regionalTitle} text={t.regionalText} />
            <PeeklistsRow items={regional} />
          </section>
        ) : null}

        {platform.length > 0 ? (
          <section>
            <SectionHeader title={t.platformTitle} text={t.platformText} />
            <PeeklistsRow items={platform} />
          </section>
        ) : null}

        {people.length > 0 ? (
          <section>
            <SectionHeader title={t.peopleTitle} text={t.peopleText} />
            <PeeklistsRow items={people} />
          </section>
        ) : null}

        {trending.length > 0 ? (
          <section>
            <SectionHeader title={t.trendingTitle} text={t.trendingText} />
            <PeeklistsRow items={trending} />
          </section>
        ) : null}
      </div>
    </>
  );
}
