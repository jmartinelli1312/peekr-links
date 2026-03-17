export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w342";
const PERSON = "https://image.tmdb.org/t/p/w185";
const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

type TmdbTitle = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
};

type TmdbPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
};

type PeekrActivity = {
  tmdb_id: number | null;
  title: string | null;
  poster_path: string | null;
  media_type: string | null;
  rating: number | null;
  watched_at: string | null;
};

type EditorialCollection = {
  slug: string;
  title_en: string;
  title_es: string;
  title_pt: string;
  source_type?: string | null;
  category?: string | null;
  item_count?: number | null;
  is_published: boolean;
  sort_order: number;
};

type EditorialCollectionItem = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  position: number;
};

export async function generateMetadata() {
  return {
    title: "Peekr | The social network for movies and series",
    description:
      "Discover movies, TV series, actors and real social activity around what people are watching on Peekr.",
    openGraph: {
      title: "Peekr | The social network for movies and series",
      description:
        "Track what you watch, rate titles, create Peeklists and discover what people are watching in real time.",
      type: "website",
      url: "https://www.peekr.app",
      siteName: "Peekr",
    },
    twitter: {
      card: "summary_large_image",
      title: "Peekr | The social network for movies and series",
      description:
        "Track what you watch, rate titles, create Peeklists and discover what people are watching in real time.",
    },
    alternates: {
      canonical: "https://www.peekr.app",
    },
  };
}

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

async function fetchTMDB<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getTmdbHomeData(lang: Lang) {
  const apiLang = tmdbLanguage(lang);

  const [trendingMovies, trendingTV, popularPeople] = await Promise.all([
    fetchTMDB<{ results: TmdbTitle[] }>(
      `${TMDB_BASE}/trending/movie/week?api_key=${TMDB_KEY}&language=${apiLang}`
    ),
    fetchTMDB<{ results: TmdbTitle[] }>(
      `${TMDB_BASE}/trending/tv/week?api_key=${TMDB_KEY}&language=${apiLang}`
    ),
    fetchTMDB<{ results: TmdbPerson[] }>(
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

function localizedCollectionTitle(
  item: EditorialCollection,
  lang: Lang
): string {
  if (lang === "es") return item.title_es || item.title_en || item.title_pt;
  if (lang === "pt") return item.title_pt || item.title_en || item.title_es;
  return item.title_en || item.title_es || item.title_pt;
}

async function getHomepagePlatformCollections(lang: Lang) {
  const { data: collections, error } = await supabase
    .from("editorial_collections")
    .select(
      "slug,title_en,title_es,title_pt,source_type,category,item_count,is_published,sort_order"
    )
    .eq("is_published", true)
    .eq("source_type", "platform_releases")
    .order("sort_order", { ascending: true })
    .limit(8);

  if (error || !collections) return [];

  const filtered = (collections as EditorialCollection[]).filter(
    (item) => (item.item_count ?? 0) > 0
  );

  const rows = await Promise.all(
    filtered.map(async (collection) => {
      const { data: items } = await supabase
        .from("editorial_collection_items")
        .select("tmdb_id,media_type,position")
        .eq("collection_slug", collection.slug)
        .order("position", { ascending: true })
        .limit(1);

      const first = (items?.[0] as EditorialCollectionItem | undefined) ?? null;
      if (!first) return null;

      const type = first.media_type === "tv" ? "tv" : "movie";
      const detail = await fetchTMDB<TmdbTitle>(
        `${TMDB_BASE}/${type}/${first.tmdb_id}?api_key=${TMDB_KEY}&language=${tmdbLanguage(lang)}`
      );

      return {
        id: collection.slug,
        title: localizedCollectionTitle(collection, lang),
        posterPath: detail?.poster_path ?? null,
        mediaType: type,
        tmdbId: first.tmdb_id,
        href: `/lists/${collection.slug}`,
      };
    })
  );

  return rows.filter(Boolean) as Array<{
    id: string;
    title: string;
    posterPath: string | null;
    mediaType: "movie" | "tv";
    tmdbId: number;
    href: string;
  }>;
}

function getYear(item: TmdbTitle) {
  const raw = item.release_date || item.first_air_date || "";
  return raw ? raw.slice(0, 4) : "";
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
  tmdb_id?: number | null;
  id?: number | null;
  media_type?: string | null;
  title?: string | null;
  name?: string | null;
}) {
  const id = item.tmdb_id ?? item.id;
  const type = item.media_type === "tv" ? "tv" : "movie";
  const rawTitle = item.title || item.name || "title";
  const slug = slugify(rawTitle);
  return `/title/${type}/${id}-${slug}`;
}

function actorHref(person: TmdbPerson) {
  return `/actor/${person.id}-${slugify(person.name)}`;
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

function TitleRow({
  items,
  type,
}: {
  items: TmdbTitle[];
  type: "movie" | "tv";
}) {
  return (
    <div className="scroll-row">
      {items.slice(0, 12).map((item) => {
        const title = item.title || item.name || "Untitled";
        const poster = item.poster_path ? `${POSTER}${item.poster_path}` : null;

        return (
          <Link
            key={`${type}-${item.id}`}
            href={titleHref({
              id: item.id,
              media_type: type,
              title: item.title,
              name: item.name,
            })}
            className="poster-card"
          >
            {poster ? (
              <img src={poster} alt={title} className="poster-image" />
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

function PlatformRow({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    posterPath: string | null;
    mediaType: "movie" | "tv";
    tmdbId: number;
    href: string;
  }>;
}) {
  return (
    <div className="scroll-row">
      {items.map((item) => {
        const poster = item.posterPath ? `${POSTER}${item.posterPath}` : null;

        return (
          <Link key={item.id} href={item.href} className="poster-card">
            {poster ? (
              <img src={poster} alt={item.title} className="poster-image" />
            ) : (
              <div className="poster-fallback" />
            )}

            <div className="poster-meta">
              <div className="poster-title">{item.title}</div>
              <div className="poster-year">
                {item.mediaType === "tv" ? "TV" : "Movie"}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PeopleRow({ items }: { items: TmdbPerson[] }) {
  return (
    <div className="scroll-row">
      {items.slice(0, 12).map((person) => {
        const photo = person.profile_path
          ? `${PERSON}${person.profile_path}`
          : null;

        return (
          <Link key={person.id} href={actorHref(person)} className="person-card">
            {photo ? (
              <img src={photo} alt={person.name} className="person-image" />
            ) : (
              <div className="person-fallback" />
            )}

            <div className="person-name">{person.name}</div>
          </Link>
        );
      })}
    </div>
  );
}

function PeekrRow({
  items,
  showRating,
}: {
  items: PeekrActivity[];
  showRating: boolean;
}) {
  return (
    <div className="scroll-row">
      {items.map((item, index) => {
        const title = item.title || "Untitled";
        const poster = item.poster_path ? `${POSTER}${item.poster_path}` : null;
        const href = titleHref(item);

        return (
          <Link
            key={`${item.media_type}-${item.tmdb_id}-${index}`}
            href={href}
            className="poster-card"
          >
            {poster ? (
              <img src={poster} alt={title} className="poster-image" />
            ) : (
              <div className="poster-fallback" />
            )}

            <div className="poster-meta">
              <div className="poster-title">{title}</div>
              <div className="poster-year">
                {showRating && item.rating != null ? `⭐ ${item.rating}/10` : ""}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      heroTitle: "The social network for movies and series.",
      heroText:
        "Track what you watch, rate titles, create Peeklists and discover what people are watching in real time.",
      createAccount: "Create account",
      downloadApp: "Download app",
      trendingMovies: "Trending movies",
      trendingMoviesText:
        "What the world is watching right now in movies.",
      trendingTV: "Trending TV series",
      trendingTVText:
        "Series people are watching, discussing and sharing right now.",
      platformTitle: "Streaming picks by platform",
      platformText:
        "Discover fresh releases and curated picks grouped by platform.",
      peopleTitle: "Popular people",
      peopleText:
        "Go beyond titles and discover the actors and creators shaping what everyone is watching now.",
      peekrTitle: "Trending on Peekr",
      peekrText:
        "Live activity from the community: the latest watched and rated titles on Peekr.",
      whyTitle: "Why Peekr feels different",
      why1: "Movies and TV series in one place",
      why2: "Real social activity, not just logging",
      why3: "Peeklists built to share taste",
      why4: "Discover actors, titles and awards",
      ctaTitle: "Start building your taste graph.",
      ctaText:
        "Create your account, track what you watch and discover your next obsession.",
    },
    es: {
      heroTitle: "La red social para películas y series.",
      heroText:
        "Lleva registro de lo que ves, califica títulos, crea Peeklists y descubre lo que la gente está viendo en tiempo real.",
      createAccount: "Crear cuenta",
      downloadApp: "Bajar app",
      trendingMovies: "Películas en tendencia",
      trendingMoviesText:
        "Lo que el mundo está viendo ahora mismo en cine.",
      trendingTV: "Series en tendencia",
      trendingTVText:
        "Series que la gente está viendo, comentando y compartiendo ahora.",
      platformTitle: "Picks por plataforma",
      platformText:
        "Descubre estrenos recientes y colecciones curadas agrupadas por plataforma.",
      peopleTitle: "Personas populares",
      peopleText:
        "Ve más allá de los títulos y descubre actores y creadores que están definiendo lo que todos están viendo.",
      peekrTitle: "Trending on Peekr",
      peekrText:
        "Actividad en vivo de la comunidad: los últimos títulos vistos y calificados en Peekr.",
      whyTitle: "Por qué Peekr se siente diferente",
      why1: "Películas y series en un mismo lugar",
      why2: "Actividad social real, no solo logging",
      why3: "Peeklists hechas para compartir gusto",
      why4: "Descubre actores, títulos y premios",
      ctaTitle: "Empieza a construir tu mapa de gustos.",
      ctaText:
        "Crea tu cuenta, registra lo que ves y descubre tu próxima obsesión.",
    },
    pt: {
      heroTitle: "A rede social para filmes e séries.",
      heroText:
        "Registre o que você assiste, avalie títulos, crie Peeklists e descubra o que as pessoas estão vendo em tempo real.",
      createAccount: "Criar conta",
      downloadApp: "Baixar app",
      trendingMovies: "Filmes em alta",
      trendingMoviesText:
        "O que o mundo está assistindo agora em filmes.",
      trendingTV: "Séries em alta",
      trendingTVText:
        "Séries que as pessoas estão assistindo, comentando e compartilhando agora.",
      platformTitle: "Picks por plataforma",
      platformText:
        "Descubra lançamentos recentes e coleções curadas por plataforma.",
      peopleTitle: "Pessoas populares",
      peopleText:
        "Vá além dos títulos e descubra atores e criadores que estão moldando o que todo mundo está assistindo agora.",
      peekrTitle: "Trending on Peekr",
      peekrText:
        "Atividade ao vivo da comunidade: os últimos títulos assistidos e avaliados no Peekr.",
      whyTitle: "Por que Peekr é diferente",
      why1: "Filmes e séries no mesmo lugar",
      why2: "Atividade social real, não só logging",
      why3: "Peeklists feitas para compartilhar gosto",
      why4: "Descubra atores, títulos e premiações",
      ctaTitle: "Comece a construir seu mapa de gosto.",
      ctaText:
        "Crie sua conta, registre o que assiste e descubra sua próxima obsessão.",
    },
  }[lang];

  const [{ trendingMovies, trendingTV, popularPeople }, trendingOnPeekr, platformCollections] =
    await Promise.all([
      getTmdbHomeData(lang),
      getTrendingOnPeekr(),
      getHomepagePlatformCollections(lang),
    ]);

  return (
    <>
      <style>{`
        .home-page {
          display: flex;
          flex-direction: column;
          gap: 56px;
        }

        .hero {
          padding-top: 4px;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(250,0,130,0.12);
          color: ${BRAND};
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 18px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(44px, 10vw, 72px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
          max-width: 840px;
        }

        .hero p {
          margin: 18px 0 0 0;
          max-width: 760px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .hero-actions,
        .cta-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 24px;
        }

        .btn-primary,
        .btn-secondary {
          text-decoration: none;
          border-radius: 16px;
          padding: 14px 18px;
          font-weight: 800;
          font-size: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .btn-primary {
          background: ${BRAND};
          color: white;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.10);
          color: white;
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

        .scroll-row {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }

        .poster-card,
        .person-card {
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

        .why-box {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          border-radius: 28px;
          padding: 22px;
        }

        .why-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-top: 8px;
        }

        .why-card {
          border-radius: 18px;
          padding: 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.88);
          font-weight: 700;
          line-height: 1.5;
          font-size: 15px;
        }

        .cta-final {
          text-align: center;
          padding: 8px 0 8px 0;
        }

        .cta-final h2 {
          margin: 0;
          font-size: clamp(38px, 8vw, 52px);
          line-height: 1.02;
          color: white;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .cta-final p {
          margin: 16px auto 0 auto;
          max-width: 760px;
          color: rgba(255,255,255,0.72);
          font-size: 16px;
          line-height: 1.7;
        }

        @media (min-width: 900px) {
          .home-page {
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

          .why-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="home-page">
        <section className="hero">
          <div className="hero-badge">Peekr</div>

          <h1>{t.heroTitle}</h1>

          <p>{t.heroText}</p>

          <div className="hero-actions">
            <Link href="/signup" className="btn-primary">
              {t.createAccount}
            </Link>

            <a
              href="mailto:info@peekr.app?subject=Peekr%20App"
              className="btn-secondary"
            >
              {t.downloadApp}
            </a>
          </div>
        </section>

        <section>
          <SectionHeader title={t.trendingMovies} text={t.trendingMoviesText} />
          <TitleRow items={trendingMovies} type="movie" />
        </section>

        <section>
          <SectionHeader title={t.trendingTV} text={t.trendingTVText} />
          <TitleRow items={trendingTV} type="tv" />
        </section>

        {platformCollections.length > 0 ? (
          <section>
            <SectionHeader title={t.platformTitle} text={t.platformText} />
            <PlatformRow items={platformCollections} />
          </section>
        ) : null}

        <section>
          <SectionHeader title={t.peopleTitle} text={t.peopleText} />
          <PeopleRow items={popularPeople} />
        </section>

        <section>
          <SectionHeader title={t.peekrTitle} text={t.peekrText} />
          <PeekrRow items={trendingOnPeekr} showRating />
        </section>

        <section className="why-box">
          <SectionHeader title={t.whyTitle} />
          <div className="why-grid">
            {[t.why1, t.why2, t.why3, t.why4].map((item) => (
              <div key={item} className="why-card">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="cta-final">
          <h2>{t.ctaTitle}</h2>
          <p>{t.ctaText}</p>

          <div className="cta-actions">
            <Link href="/signup" className="btn-primary">
              {t.createAccount}
            </Link>

            <a
              href="mailto:info@peekr.app?subject=Peekr%20App"
              className="btn-secondary"
            >
              {t.downloadApp}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
