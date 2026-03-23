export const revalidate = 3600;

import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const BACKDROP = "https://image.tmdb.org/t/p/w780";
const PROFILE = "https://image.tmdb.org/t/p/w185";
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

type TmdbPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string | null;
  popularity?: number | null;
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

function actorHref(person: TmdbPerson) {
  return `/actor/${person.id}-${slugify(person.name)}`;
}

function localizedCollectionTitle(item: EditorialCollection, lang: Lang) {
  if (lang === "es") return item.title_es || item.title_en || item.title_pt;
  if (lang === "pt") return item.title_pt || item.title_en || item.title_es;
  return item.title_en || item.title_es || item.title_pt;
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

async function getPopularPeople(lang: Lang) {
  const apiLang = tmdbLanguage(lang);

  const trending = await fetchTMDB<{ results: TmdbPerson[] }>(
    `${TMDB_BASE}/trending/person/week?api_key=${TMDB_KEY}&language=${apiLang}`
  );

  const all = trending?.results ?? [];

  const actorCandidates = all.filter(
    (person) => (person.known_for_department ?? "").toLowerCase() === "acting"
  );

  const actors = actorCandidates.slice(0, 20);

  const directorMatches: TmdbPerson[] = [];

  for (const person of all) {
    try {
      const credits = await fetchTMDB<{
        crew?: Array<{
          job?: string | null;
          department?: string | null;
          media_type?: string | null;
        }>;
      }>(
        `${TMDB_BASE}/person/${person.id}/combined_credits?api_key=${TMDB_KEY}&language=${apiLang}`
      );

      const isDirector = (credits?.crew ?? []).some((item) => {
        const job = (item.job ?? "").toLowerCase();
        const dept = (item.department ?? "").toLowerCase();
        const media = item.media_type ?? "";
        return (
          (media === "movie" || media === "tv") &&
          (job === "director" || dept === "directing")
        );
      });

      if (isDirector) {
        directorMatches.push(person);
      }
    } catch {
      // ignore
    }

    if (directorMatches.length >= 20) break;
  }

  const fallbackDirectors: TmdbPerson[] = [
    { id: 525, name: "Christopher Nolan" },
    { id: 488, name: "Steven Spielberg" },
    { id: 137427, name: "Denis Villeneuve" },
    { id: 1032, name: "Martin Scorsese" },
    { id: 138, name: "Quentin Tarantino" },
    { id: 65540, name: "Pedro Almodóvar" },
    { id: 138, name: "Quentin Tarantino" },
    { id: 819, name: "David Fincher" },
    { id: 138, name: "Quentin Tarantino" },
    { id: 5655, name: "Guillermo del Toro" },
    { id: 2740, name: "Alfonso Cuarón" },
    { id: 6384, name: "Alejandro González Iñárritu" },
    { id: 2939, name: "J. A. Bayona" },
    { id: 4292, name: "Wes Anderson" },
    { id: 138, name: "Quentin Tarantino" },
    { id: 11431, name: "Damián Szifron" },
    { id: 11432, name: "Juan José Campanella" },
    { id: 8462, name: "Pablo Trapero" },
    { id: 18124, name: "Lucrecia Martel" },
    { id: 14784, name: "James Cameron" },
  ];

  const seen = new Set<number>();
  const directors: TmdbPerson[] = [];

  for (const person of directorMatches) {
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    directors.push(person);
    if (directors.length >= 20) break;
  }

  if (directors.length < 20) {
    for (const fallback of fallbackDirectors) {
      if (seen.has(fallback.id)) continue;

      const searched = await fetchTMDB<{ results: TmdbPerson[] }>(
        `${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&language=${apiLang}&query=${encodeURIComponent(fallback.name)}`
      );

      const match = searched?.results?.[0];
      if (!match || seen.has(match.id)) continue;

      seen.add(match.id);
      directors.push(match);
      if (directors.length >= 20) break;
    }
  }

  return { actors, directors };
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

function PeopleRow({
  items,
}: {
  items: TmdbPerson[];
}) {
  return (
    <div className="people-row">
      {items.map((person) => {
        const photo = person.profile_path ? `${PROFILE}${person.profile_path}` : null;

        return (
          <Link
            key={person.id}
            href={actorHref(person)}
            className="person-card"
          >
            {photo ? (
              <img
                src={photo}
                alt={person.name}
                className="person-image"
              />
            ) : (
              <div className="person-fallback" />
            )}

            <div className="person-meta">
              <div className="person-name">{person.name}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export async function generateMetadata() {
  return {
    title: "Peeklists | Peekr",
    description:
      "Discover award winners, curated collections, streaming picks, popular actors, popular directors and trending movie and TV collections on Peekr.",
    alternates: {
      canonical: "https://www.peekr.app/lists",
    },
    openGraph: {
      title: "Peeklists | Peekr",
      description:
        "Discover award winners, curated collections, streaming picks, popular actors, popular directors and trending movie and TV collections on Peekr.",
      url: "https://www.peekr.app/lists",
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Peeklists | Peekr",
      description:
        "Discover award winners, curated collections, streaming picks, popular actors, popular directors and trending movie and TV collections on Peekr.",
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
        "Discover award winners, curated collections, streaming picks, popular actors, popular directors and what is trending right now.",
      awardsTitle: "Award winners",
      awardsText: "Oscars, Emmys, Golden Globes, BAFTA and festival winners.",
      curatedTitle: "Curated collections",
      curatedText: "Handpicked lists built for discovery and taste.",
      regionalTitle: "Regional picks",
      regionalText: "Collections tailored to Latin America and local taste.",
      platformTitle: "By platform",
      platformText: "Recent releases grouped by streaming platform.",
      actorsTitle: "Popular actors",
      actorsText: "Discover actors people are searching and watching right now.",
      directorsTitle: "Popular directors",
      directorsText: "Discover directors shaping what people are watching now.",
      trendingTitle: "Trending now",
      trendingText: "Strictly filtered trending collections by category.",
    },
    es: {
      title: "Peeklists",
      subtitle:
        "Descubre ganadores de premios, listas curadas, picks por plataforma, actores populares, directores populares y lo que está en tendencia ahora.",
      awardsTitle: "Ganadores de premios",
      awardsText: "Oscars, Emmys, Golden Globes, BAFTA y ganadores de festivales.",
      curatedTitle: "Listas curadas",
      curatedText: "Listas elegidas a mano para discovery y gusto.",
      regionalTitle: "Selecciones regionales",
      regionalText: "Colecciones pensadas para LATAM y el gusto local.",
      platformTitle: "Por plataforma",
      platformText: "Estrenos recientes agrupados por plataforma.",
      actorsTitle: "Actores populares",
      actorsText: "Descubre actores que la gente está buscando y viendo ahora.",
      directorsTitle: "Directores populares",
      directorsText: "Descubre directores que están marcando lo que la gente ve hoy.",
      trendingTitle: "En tendencia ahora",
      trendingText: "Colecciones trending con filtros estrictos por categoría.",
    },
    pt: {
      title: "Peeklists",
      subtitle:
        "Descubra vencedores de prêmios, listas curadas, picks por plataforma, atores populares, diretores populares e o que está em alta agora.",
      awardsTitle: "Vencedores de prêmios",
      awardsText: "Oscars, Emmys, Golden Globes, BAFTA e vencedores de festivais.",
      curatedTitle: "Listas curadas",
      curatedText: "Listas escolhidas à mão para discovery e gosto.",
      regionalTitle: "Seleções regionais",
      regionalText: "Coleções pensadas para LATAM e gosto local.",
      platformTitle: "Por plataforma",
      platformText: "Lançamentos recentes agrupados por plataforma.",
      actorsTitle: "Atores populares",
      actorsText: "Descubra atores que as pessoas estão buscando e assistindo agora.",
      directorsTitle: "Diretores populares",
      directorsText: "Descubra diretores que estão moldando o que as pessoas assistem agora.",
      trendingTitle: "Em alta agora",
      trendingText: "Coleções em alta com filtros estritos por categoria.",
    },
  }[lang];

  const [
    awards,
    curated,
    regional,
    platform,
    trending,
    people,
  ] = await Promise.all([
    getCollectionsByCategory(["awards"], lang, 24),
    getCollectionsByCategory(["curated"], lang, 40),
    getCollectionsByCategory(["regional"], lang, 20),
    getCollectionsBySourceType(["platform_releases"], lang, 16),
    getCollectionsBySourceType(["trend_driven"], lang, 16),
    getPopularPeople(lang),
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

        .peeklists-row,
        .people-row {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }

        .peeklist-card,
        .person-card {
          text-decoration: none;
          color: white;
          scroll-snap-align: start;
        }

        .peeklist-card {
          width: 260px;
          min-width: 260px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          overflow: hidden;
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
          box-shadow: 0 12px 30px rgba(0,0,0,0.28);
        }

        .person-meta {
          margin-top: 10px;
        }

        .person-name {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.35;
          color: rgba(255,255,255,0.95);
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

        {people.actors.length > 0 ? (
          <section>
            <SectionHeader title={t.actorsTitle} text={t.actorsText} />
            <PeopleRow items={people.actors} />
          </section>
        ) : null}

        {people.directors.length > 0 ? (
          <section>
            <SectionHeader title={t.directorsTitle} text={t.directorsText} />
            <PeopleRow items={people.directors} />
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
