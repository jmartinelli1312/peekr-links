export const revalidate = 21600; // 6h

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ExploreSearch from "./explore-search";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w342";
const PERSON = "https://image.tmdb.org/t/p/w185";
const BRAND = "#FA0082";
const SITE = "https://www.peekr.app";

type Lang = "en" | "es" | "pt";

type ExplorePageProps = {
  params: Promise<{
    lang: string;
  }>;
};

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  media_type?: "movie" | "tv" | "person";
  release_date?: string | null;
  first_air_date?: string | null;
};

type PersonItem = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string | null;
};

type ProfileItem = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type PeeklistItem = {
  id: string | number;
  title?: string | null;
  cover_url?: string | null;
};

type PeekrActivity = {
  tmdb_id: number | null;
  title: string | null;
  poster_path: string | null;
  media_type: string | null;
  rating: number | null;
  watched_at: string | null;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "es").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("es")) return "es";
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

function titleHref(
  lang: Lang,
  item: {
    tmdb_id?: number | null;
    id?: number | null;
    media_type?: string | null;
    title?: string | null;
    name?: string | null;
  }
) {
  const id = item.tmdb_id ?? item.id;
  const type = item.media_type === "tv" ? "tv" : "movie";
  const rawTitle = item.title || item.name || "title";
  return `/${lang}/title/${type}/${id}-${slugify(rawTitle)}`;
}

function actorHref(lang: Lang, person: PersonItem) {
  return `/${lang}/actor/${person.id}-${slugify(person.name)}`;
}

function userHref(lang: Lang, username?: string | null) {
  return username ? `/${lang}/u/${username}` : "#";
}

function peeklistHref(lang: Lang, id: string | number) {
  return `/${lang}/peeklist/${id}`;
}

function getYear(item: {
  release_date?: string | null;
  first_air_date?: string | null;
}) {
  const raw = item.release_date || item.first_air_date || "";
  return raw ? raw.slice(0, 4) : "";
}

async function fetchTMDB<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getExploreData(lang: Lang) {
  const apiLang = tmdbLanguage(lang);

  const [trendingMovies, trendingTV, popularPeople] = await Promise.all([
    fetchTMDB<{ results: TmdbItem[] }>(
      `${TMDB_BASE}/trending/movie/week?api_key=${TMDB_KEY}&language=${apiLang}`
    ),
    fetchTMDB<{ results: TmdbItem[] }>(
      `${TMDB_BASE}/trending/tv/week?api_key=${TMDB_KEY}&language=${apiLang}`
    ),
    fetchTMDB<{ results: PersonItem[] }>(
      `${TMDB_BASE}/person/popular?api_key=${TMDB_KEY}&language=${apiLang}`
    ),
  ]);

  return {
    trendingMovies: trendingMovies?.results ?? [],
    trendingTV: trendingTV?.results ?? [],
    popularPeople: popularPeople?.results ?? [],
  };
}

async function getTrendingOnPeekr() {
  try {
    const { data, error } = await supabase.rpc("get_home_trending_on_peekr", {
      limit_count: 12,
    });

    if (error) return [];
    return (data as PeekrActivity[] | null) ?? [];
  } catch {
    return [];
  }
}

async function getPeeklists(): Promise<PeeklistItem[]> {
  const { data } = await supabase
    .from("peeklists")
    .select("id,title,cover_url")
    .limit(12);

  return (data as PeeklistItem[] | null) ?? [];
}

function getStrings(lang: Lang) {
  return {
    en: {
      metaTitle: "Explore | Peekr",
      metaDescription:
        "Explore movies, TV series, people, users and Peeklists on Peekr.",
      title: "Explore",
      searchPlaceholder: "Search movies, series, cast, crew or users",
      clear: "Clear",
      search: "Search",
      titles: "Titles",
      people: "Cast & Crew",
      users: "Users",
      searchResults: "Search results for",
      peeklists: "Peeklists",
      peeklistsText: "Curated collections built to discover and share taste.",
      trendingPeekrMovies: "Trending on Peekr · Movies",
      trendingPeekrTV: "Trending on Peekr · TV",
      trendingPeekrText: "Live social activity from the Peekr community.",
      trendingMovies: "Trending Movies",
      trendingMoviesText: "What’s breaking out this week across film.",
      trendingTV: "Trending TV",
      trendingTVText: "The series people are discovering right now.",
      popularPeople: "Popular People",
      popularPeopleText:
        "Actors and creators shaping what everyone is watching.",
      noResults: "No results found.",
    },
    es: {
      metaTitle: "Explorar | Peekr",
      metaDescription:
        "Explora películas, series, personas, usuarios y Peeklists en Peekr.",
      title: "Explorar",
      searchPlaceholder: "Buscar películas, series, cast, crew o usuarios",
      clear: "Limpiar",
      search: "Buscar",
      titles: "Títulos",
      people: "Cast y Crew",
      users: "Usuarios",
      searchResults: "Resultados para",
      peeklists: "Peeklists",
      peeklistsText:
        "Colecciones curadas para descubrir y compartir gustos.",
      trendingPeekrMovies: "Trending on Peekr · Películas",
      trendingPeekrTV: "Trending on Peekr · Series",
      trendingPeekrText:
        "Actividad social en vivo de la comunidad de Peekr.",
      trendingMovies: "Películas en tendencia",
      trendingMoviesText: "Lo que está explotando esta semana en cine.",
      trendingTV: "Series en tendencia",
      trendingTVText:
        "Las series que la gente está descubriendo ahora mismo.",
      popularPeople: "Personas populares",
      popularPeopleText:
        "Actores y creadores que están marcando lo que todos ven.",
      noResults: "No se encontraron resultados.",
    },
    pt: {
      metaTitle: "Explorar | Peekr",
      metaDescription:
        "Explore filmes, séries, pessoas, usuários e Peeklists no Peekr.",
      title: "Explorar",
      searchPlaceholder: "Buscar filmes, séries, cast, crew ou usuários",
      clear: "Limpar",
      search: "Buscar",
      titles: "Títulos",
      people: "Cast & Crew",
      users: "Usuários",
      searchResults: "Resultados para",
      peeklists: "Peeklists",
      peeklistsText:
        "Coleções curadas para descobrir e compartilhar gosto.",
      trendingPeekrMovies: "Trending on Peekr · Filmes",
      trendingPeekrTV: "Trending on Peekr · Séries",
      trendingPeekrText:
        "Atividade social ao vivo da comunidade do Peekr.",
      trendingMovies: "Filmes em alta",
      trendingMoviesText:
        "O que está crescendo esta semana no cinema.",
      trendingTV: "Séries em alta",
      trendingTVText: "As séries que as pessoas estão descobrindo agora.",
      popularPeople: "Pessoas populares",
      popularPeopleText:
        "Atores e criadores moldando o que todo mundo está assistindo.",
      noResults: "Nenhum resultado encontrado.",
    },
  }[lang];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = normalizeLang(rawLang);
  const t = getStrings(lang);

  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical: `${SITE}/${lang}/explore`,
      languages: {
        es: `${SITE}/es/explore`,
        en: `${SITE}/en/explore`,
        pt: `${SITE}/pt/explore`,
        "x-default": `${SITE}/es/explore`,
      },
    },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: `${SITE}/${lang}/explore`,
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle,
      description: t.metaDescription,
    },
  };
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

function PosterRow({
  items,
  type,
  lang,
}: {
  items: TmdbItem[];
  type: "movie" | "tv";
  lang: Lang;
}) {
  return (
    <div className="scroll-row">
      {items.slice(0, 20).map((item) => {
        const title = item.title || item.name || "Untitled";

        return (
          <Link
            key={`${type}-${item.id}`}
            href={titleHref(lang, {
              id: item.id,
              media_type: type,
              title: item.title,
              name: item.name,
            })}
            className="poster-card"
          >
            {item.poster_path ? (
              <img
                src={`${POSTER}${item.poster_path}`}
                alt={title}
                className="poster-image"
              />
            ) : (
              <div className="poster-fallback" />
            )}

            <div className="poster-meta">
              <div className="poster-title">{title}</div>
              <div className="poster-year">{getYear(item)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PeekrOnlyRow({
  items,
  lang,
}: {
  items: PeekrActivity[];
  lang: Lang;
}) {
  return (
    <div className="scroll-row">
      {items.map((item, index) => {
        const title = item.title || "Untitled";
        return (
          <Link
            key={`${item.media_type}-${item.tmdb_id}-${index}`}
            href={titleHref(lang, item)}
            className="poster-card"
          >
            {item.poster_path ? (
              <img
                src={`${POSTER}${item.poster_path}`}
                alt={title}
                className="poster-image"
              />
            ) : (
              <div className="poster-fallback" />
            )}

            <div className="poster-meta">
              <div className="poster-title">{title}</div>
              <div className="poster-year">
                {item.rating != null ? `⭐ ${item.rating.toFixed(1)}/10` : ""}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PeopleRow({
  items,
  lang,
}: {
  items: PersonItem[];
  lang: Lang;
}) {
  return (
    <div className="scroll-row">
      {items.slice(0, 20).map((person) => (
        <Link
          key={person.id}
          href={actorHref(lang, person)}
          className="person-card"
        >
          {person.profile_path ? (
            <img
              src={`${PERSON}${person.profile_path}`}
              alt={person.name}
              className="person-image"
            />
          ) : (
            <div className="person-fallback" />
          )}

          <div className="person-name">{person.name}</div>
          {person.known_for_department ? (
            <div className="person-sub">{person.known_for_department}</div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function PeeklistsRow({
  items,
  lang,
}: {
  items: PeeklistItem[];
  lang: Lang;
}) {
  return (
    <div className="peeklists-row">
      {items.map((pl) => (
        <Link
          key={String(pl.id)}
          href={peeklistHref(lang, pl.id)}
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

          <div className="peeklist-title">{pl.title || "Peeklist"}</div>
        </Link>
      ))}
    </div>
  );
}

export default async function ExplorePage({
  params,
}: ExplorePageProps) {
  const { lang: rawLang } = await params;
  const lang = normalizeLang(rawLang);

  if (!["en", "es", "pt"].includes(lang)) {
    notFound();
  }

  const t = getStrings(lang);

  const [{ trendingMovies, trendingTV, popularPeople }, trendingOnPeekr, peeklists] =
    await Promise.all([
      getExploreData(lang),
      getTrendingOnPeekr(),
      getPeeklists(),
    ]);

  const peekrMovies = trendingOnPeekr.filter((i) => i.media_type === "movie");
  const peekrTV = trendingOnPeekr.filter((i) => i.media_type === "tv");

  return (
    <>
      <style>{`
        .explore-page {
          display: flex;
          flex-direction: column;
          gap: 56px;
        }

        .hero {
          padding-top: 4px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(44px, 10vw, 72px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
        }

        .search-form {
          margin-top: 20px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }

        .search-input {
          flex: 1 1 420px;
          min-width: 260px;
          padding: 15px 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.06);
          color: #fff;
          font-size: 15px;
          outline: none;
        }

        .search-input::placeholder {
          color: rgba(255,255,255,0.45);
        }

        .btn-primary,
        .btn-secondary {
          text-decoration: none;
          border-radius: 14px;
          padding: 14px 16px;
          font-weight: 800;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
        }

        .btn-primary {
          background: ${BRAND};
          color: white;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.08);
          color: white;
          border: 1px solid rgba(255,255,255,0.10);
        }

        .bubble-row {
          margin-top: 14px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .bubble {
          padding: 10px 14px;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 700;
          font-size: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
        }

        .bubble.active {
          background: ${BRAND};
          border-color: ${BRAND};
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

        .scroll-row,
        .peeklists-row {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }

        .poster-card,
        .person-card,
        .peeklist-card {
          text-decoration: none;
          color: white;
          flex: 0 0 auto;
          scroll-snap-align: start;
        }

        .poster-card {
          width: 136px;
          min-width: 136px;
        }

        .poster-image,
        .poster-fallback {
          width: 136px;
          aspect-ratio: 2 / 3;
          border-radius: 16px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
          box-shadow: 0 14px 36px rgba(0,0,0,0.35);
        }

        .poster-meta {
          margin-top: 10px;
        }

        .poster-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.35;
          color: rgba(255,255,255,0.95);
        }

        .poster-year {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          min-height: 16px;
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

        .person-name {
          margin-top: 10px;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.35;
          color: rgba(255,255,255,0.95);
        }

        .person-sub {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255,255,255,0.55);
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

        .peeklist-title {
          padding: 13px 14px;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
        }

        .search-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill,minmax(160px,1fr));
          gap: 18px;
        }

        .search-card {
          width: auto;
          min-width: 0;
        }

        .search-card .poster-image,
        .search-card .poster-fallback {
          width: 100%;
        }

        .people-grid {
          grid-template-columns: repeat(auto-fill,minmax(180px,1fr));
        }

        .people-search-card {
          text-decoration: none;
          color: white;
          background: rgba(255,255,255,0.05);
          padding: 12px;
          border-radius: 16px;
        }

        .people-search-image,
        .people-search-fallback {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 12px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
        }

        .people-search-name {
          margin-top: 10px;
          font-weight: 700;
          line-height: 1.35;
        }

        .people-search-sub {
          margin-top: 4px;
          opacity: 0.6;
          font-size: 13px;
        }

        .users-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill,minmax(220px,1fr));
          gap: 16px;
        }

        .user-card {
          display: flex;
          gap: 12px;
          padding: 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          text-decoration: none;
          color: white;
        }

        .user-avatar,
        .user-avatar-fallback {
          width: 48px;
          height: 48px;
          border-radius: 999px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          flex-shrink: 0;
        }

        .user-name {
          font-weight: 800;
          line-height: 1.35;
        }

        .user-username {
          opacity: 0.6;
          margin-top: 4px;
        }

        .empty-state {
          color: rgba(255,255,255,0.62);
          font-size: 15px;
        }

        @media (min-width: 900px) {
          .explore-page {
            gap: 72px;
          }

          .poster-card {
            width: 165px;
            min-width: 165px;
          }

          .poster-image,
          .poster-fallback {
            width: 165px;
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

      <div className="explore-page">
        <section className="hero">
          <h1>{t.title}</h1>

          <ExploreSearch
            lang={lang}
            t={{
              searchPlaceholder: t.searchPlaceholder,
              clear: t.clear,
              search: t.search,
              titles: t.titles,
              people: t.people,
              users: t.users,
              searchResults: t.searchResults,
              noResults: t.noResults,
            }}
          />
        </section>

        <>
            <section>
              <SectionHeader title={t.peeklists} text={t.peeklistsText} />
              <PeeklistsRow items={peeklists} lang={lang} />
            </section>

            <section>
              <SectionHeader
                title={t.trendingPeekrMovies}
                text={t.trendingPeekrText}
              />
              <PeekrOnlyRow items={peekrMovies} lang={lang} />
            </section>

            <section>
              <SectionHeader
                title={t.trendingPeekrTV}
                text={t.trendingPeekrText}
              />
              <PeekrOnlyRow items={peekrTV} lang={lang} />
            </section>

            <section>
              <SectionHeader
                title={t.trendingMovies}
                text={t.trendingMoviesText}
              />
              <PosterRow items={trendingMovies} type="movie" lang={lang} />
            </section>

            <section>
              <SectionHeader
                title={t.trendingTV}
                text={t.trendingTVText}
              />
              <PosterRow items={trendingTV} type="tv" lang={lang} />
            </section>

            <section>
              <SectionHeader
                title={t.popularPeople}
                text={t.popularPeopleText}
              />
              <PeopleRow items={popularPeople} lang={lang} />
            </section>
          </>
      </div>
    </>
  );
}
