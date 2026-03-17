export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB = "https://api.themoviedb.org/3";
const SITE = "https://www.peekr.app";
const IMG = "https://image.tmdb.org/t/p/w1280";
const POSTER = "https://image.tmdb.org/t/p/w342";
const PERSON = "https://image.tmdb.org/t/p/w185";
const PROVIDER = "https://image.tmdb.org/t/p/w92";
const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";
type TabKey = "overview" | "cast" | "crew" | "platforms" | "awards" | "comments";

type PageProps = {
  params: Promise<{ type: string; id: string }>;
  searchParams?: Promise<{ tab?: string }>;
};

type TmdbCast = {
  id: number;
  name: string;
  character?: string | null;
  profile_path?: string | null;
};

type TmdbCrew = {
  id: number;
  name: string;
  job?: string | null;
  profile_path?: string | null;
};

type ProviderItem = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
};

type TmdbTitleResponse = {
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  runtime?: number | null;
  episode_run_time?: number[] | null;
  genres?: { id: number; name: string }[];
  credits?: {
    cast?: TmdbCast[];
    crew?: TmdbCrew[];
  };
  videos?: {
    results?: {
      key: string;
      type: string;
      site?: string;
    }[];
  };
  created_by?: {
    id: number;
    name: string;
  }[];
  ["watch/providers"]?: {
    results?: Record<
      string,
      {
        flatrate?: ProviderItem[];
        rent?: ProviderItem[];
        buy?: ProviderItem[];
      }
    >;
  };
};

type PeekrStats = {
  avgRating: string | null;
  watchedCount: number;
  commentsCount: number;
  viewsCount: number;
};

type PeekrWatcher = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
};

type PeekrComment = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  content: string | null;
  rating: number | null;
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

function providerRegions(lang: Lang) {
  if (lang === "es") return ["AR", "ES", "US", "BR"];
  if (lang === "pt") return ["BR", "US", "AR", "ES"];
  return ["US", "AR", "BR", "ES"];
}

function parseIdSlug(idValue: string) {
  const match = idValue.match(/^(\d+)/);
  if (!match) return null;
  return Number(match[1]);
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

function personHref(id: number, name: string) {
  return `/actor/${id}-${slugify(name)}`;
}

function userHref(username?: string | null) {
  return username ? `/user/${username}` : "#";
}

function pickImportantCrew(crew: TmdbCrew[]) {
  const priority = [
    "Director",
    "Creator",
    "Writer",
    "Screenplay",
    "Executive Producer",
    "Producer",
    "Original Music Composer",
    "Director of Photography",
  ];

  const sorted = [...crew].sort((a, b) => {
    const aIndex = priority.indexOf(a.job || "");
    const bIndex = priority.indexOf(b.job || "");
    const aScore = aIndex === -1 ? 999 : aIndex;
    const bScore = bIndex === -1 ? 999 : bIndex;
    return aScore - bScore;
  });

  const seen = new Set<string>();
  const out: TmdbCrew[] = [];

  for (const item of sorted) {
    const key = `${item.id}-${item.job || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 18) break;
  }

  return out;
}

async function getLangFromCookie() {
  const cookieStore = await cookies();
  return normalizeLang(cookieStore.get("lang")?.value);
}

function getStrings(lang: Lang) {
  return {
    en: {
      directedBy: "Directed by",
      createdBy: "Created by",
      watchTrailer: "Watch Trailer",
      overview: "Overview",
      cast: "Cast",
      crew: "Crew",
      platforms: "Platforms",
      awards: "awards",
      comments: "Comments",
      usersWhoWatched: "Users who watched",
      whereToWatch: "Where to watch",
      watched: "watched",
      commentsCount: "comments",
      views: "views",
      peekrRating: "Peekr rating",
      noOverview: "No overview available.",
      noAwards: "Awards data coming soon.",
      min: "min",
      tabsOverview: "Overview",
      tabsCast: "Cast",
      tabsCrew: "Crew",
      tabsPlatforms: "Platforms",
      tabsAwards: "Awards",
      tabsComments: "Comments",
    },
    es: {
      directedBy: "Dirigida por",
      createdBy: "Creada por",
      watchTrailer: "Ver tráiler",
      overview: "Sinopsis",
      cast: "Cast",
      crew: "Crew",
      platforms: "Plataformas",
      awards: "Premios",
      comments: "Comentarios",
      usersWhoWatched: "Usuarios que la vieron",
      whereToWatch: "Dónde verla",
      watched: "vistos",
      commentsCount: "comentarios",
      views: "vistas",
      peekrRating: "Rating en Peekr",
      noOverview: "No hay sinopsis disponible.",
      noAwards: "Los premios estarán disponibles pronto.",
      min: "min",
      tabsOverview: "Sinopsis",
      tabsCast: "Cast",
      tabsCrew: "Crew",
      tabsPlatforms: "Plataformas",
      tabsAwards: "Premios",
      tabsComments: "Comentarios",
    },
    pt: {
      directedBy: "Dirigido por",
      createdBy: "Criada por",
      watchTrailer: "Ver trailer",
      overview: "Sinopse",
      cast: "Cast",
      crew: "Crew",
      platforms: "Plataformas",
      awards: "Awards",
      comments: "Comentários",
      usersWhoWatched: "Usuários que assistiram",
      whereToWatch: "Onde assistir",
      watched: "vistos",
      commentsCount: "comentários",
      views: "views",
      peekrRating: "Rating no Peekr",
      noOverview: "Sem sinopse disponível.",
      noAwards: "Os prêmios estarão disponíveis em breve.",
      min: "min",
      tabsOverview: "Sinopse",
      tabsCast: "Cast",
      tabsCrew: "Crew",
      tabsPlatforms: "Plataformas",
      tabsAwards: "Prêmios",
      tabsComments: "Comentários",
    },
  }[lang];
}

async function getTitle(type: string, id: number, lang: string) {
  const res = await fetch(
    `${TMDB}/${type}/${id}?api_key=${TMDB_KEY}&language=${lang}&append_to_response=credits,videos,watch/providers`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) return null;
  return (await res.json()) as TmdbTitleResponse;
}

function pickProviders(
  providersData: TmdbTitleResponse["watch/providers"],
  lang: Lang
) {
  const results = providersData?.results || {};
  const regions = providerRegions(lang);

  for (const region of regions) {
    const regionData = results[region];
    if (!regionData) continue;

    const combined = [
      ...(regionData.flatrate || []),
      ...(regionData.rent || []),
      ...(regionData.buy || []),
    ];

    const deduped = combined.filter(
      (item, index, arr) =>
        arr.findIndex((x) => x.provider_id === item.provider_id) === index
    );

    if (deduped.length > 0) return deduped;
  }

  return [];
}

async function getPeekrData(tmdbId: number, mediaType: string) {
  const [ratingRpcRes, activityStatsRes, titleStatsRes, watchersRes, commentsRes] =
    await Promise.all([
      supabase.rpc("get_title_peekr_rating", {
        p_tmdb_id: tmdbId,
        p_media_type: mediaType,
      }),

      supabase
        .from("title_activity_stats")
        .select("watched_count")
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType)
        .maybeSingle(),

      supabase
        .from("title_stats")
        .select("views_count")
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType)
        .maybeSingle(),

      supabase
        .from("user_title_activities")
        .select(`
          user_id,
          profiles (
            username,
            avatar_url
          )
        `)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType)
        .order("watched_at", { ascending: false })
        .limit(12),

      supabase
        .from("ratings")
        .select(`
          id,
          rating,
          comment,
          user_id,
          profiles (
            username,
            avatar_url
          )
        `)
        .eq("tmdb_id", tmdbId)
        .not("comment", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const ratingRow =
    ((ratingRpcRes.data as { avg_rating: number | null; ratings_count: number }[] | null) ?? [])[0] ??
    null;

  const avgRating =
    ratingRow?.avg_rating != null ? Number(ratingRow.avg_rating).toFixed(1) : null;

  const watchedCount =
    (activityStatsRes.data as { watched_count?: number } | null)?.watched_count ?? 0;

  const viewsCount =
    (titleStatsRes.data as { views_count?: number } | null)?.views_count ?? 0;

  const rawWatchers =
    ((watchersRes.data as any[] | null) ?? []).filter((w) => !!w?.user_id) ?? [];

  const seenUsers = new Set<string>();
  const watchers: PeekrWatcher[] = [];

  for (const row of rawWatchers) {
    if (seenUsers.has(row.user_id)) continue;
    seenUsers.add(row.user_id);

    watchers.push({
      user_id: row.user_id,
      username: row.profiles?.username ?? null,
      avatar_url: row.profiles?.avatar_url ?? null,
    });
  }

  const comments: PeekrComment[] = (((commentsRes.data as any[] | null) ?? []).map(
    (row) => ({
      id: String(row.id),
      username: row.profiles?.username ?? null,
      avatar_url: row.profiles?.avatar_url ?? null,
      content: row.comment ?? null,
      rating: typeof row.rating === "number" ? row.rating : null,
    })
  ));

  return {
    stats: {
      avgRating,
      watchedCount,
      commentsCount: comments.length,
      viewsCount,
    } as PeekrStats,
    watchers,
    comments,
  };
}

function normalizeTab(value?: string): TabKey {
  if (value === "cast") return "cast";
  if (value === "crew") return "crew";
  if (value === "platforms") return "platforms";
  if (value === "awards") return "awards";
  if (value === "comments") return "comments";
  return "overview";
}

function tabHref(tab: TabKey) {
  return `?tab=${tab}`;
}

export async function generateMetadata({ params }: PageProps) {
  const { type, id } = await params;
  const numericId = parseIdSlug(id);

  if (!numericId || (type !== "movie" && type !== "tv")) {
    return {
      title: "Peekr",
      description: "The social network for movies and series",
    };
  }

  const lang = await getLangFromCookie();
  const data = await getTitle(type, numericId, tmdbLanguage(lang));

  if (!data) {
    return {
      title: "Peekr",
      description: "The social network for movies and series",
    };
  }

  const title = data.title || data.name || "Title";
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  const slug = slugify(title);
  const canonicalPath = `/title/${type}/${numericId}-${slug}`;
  const description =
    data.overview?.slice(0, 155) || "Discover and discuss movies and series on Peekr.";

  return {
    title: `${title}${year ? ` (${year})` : ""} | Peekr`,
    description,
    alternates: {
      canonical: `${SITE}${canonicalPath}`,
    },
    openGraph: {
      title: `${title}${year ? ` (${year})` : ""} | Peekr`,
      description,
      url: `${SITE}${canonicalPath}`,
      siteName: "Peekr",
      type: "website",
      images: data.backdrop_path
        ? [
            {
              url: `${IMG}${data.backdrop_path}`,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title}${year ? ` (${year})` : ""} | Peekr`,
      description,
    },
  };
}

export default async function TitlePage({ params, searchParams }: PageProps) {
  const { type, id } = await params;

  if (type !== "movie" && type !== "tv") {
    notFound();
  }

  const numericId = parseIdSlug(id);
  if (!numericId) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const lang = await getLangFromCookie();
  const t = getStrings(lang);

  const data = await getTitle(type, numericId, tmdbLanguage(lang));
  if (!data) {
    notFound();
  }

  const title = data.title || data.name || "Title";
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  const canonicalIdSlug = `${numericId}-${slugify(title)}`;

  if (id !== canonicalIdSlug) {
    redirect(`/title/${type}/${canonicalIdSlug}`);
  }

  const { stats, watchers, comments } = await getPeekrData(numericId, type);

  const backdrop = data.backdrop_path;
  const poster = data.poster_path;
  const cast = data.credits?.cast?.slice(0, 18) || [];
  const crew = pickImportantCrew(data.credits?.crew || []);
  const director =
    data.credits?.crew?.find((c) => c.job === "Director") || null;
  const creator = data.created_by?.[0] || null;
  const providers = pickProviders(data["watch/providers"], lang);
  const trailer =
    data.videos?.results?.find(
      (v) => v.type === "Trailer" && v.site === "YouTube"
    ) ||
    data.videos?.results?.find((v) => v.type === "Trailer") ||
    null;

  const runtime =
    type === "movie"
      ? data.runtime
      : data.episode_run_time?.[0] || null;

  const availableTabs: TabKey[] = [
    "overview",
    "cast",
    "crew",
    "awards",
    ...(providers.length > 0 ? (["platforms"] as TabKey[]) : []),
    ...(comments.length > 0 ? (["comments"] as TabKey[]) : []),
  ];

  const requestedTab = normalizeTab(resolvedSearchParams?.tab);
  const activeTab = availableTabs.includes(requestedTab) ? requestedTab : "overview";

  return (
    <>
      <style>{`
        .title-page {
          min-height: 100vh;
          color: white;
        }

        .hero-backdrop {
          position: relative;
          height: 220px;
          overflow: hidden;
          border-radius: 0 0 24px 24px;
        }

        .hero-backdrop-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(11,11,15,0.14) 0%, rgba(11,11,15,0.76) 70%, rgba(11,11,15,1) 100%);
        }

        .title-shell {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 20px 40px 20px;
        }

        .title-header {
          position: relative;
          margin-top: -72px;
          display: grid;
          grid-template-columns: 126px 1fr;
          gap: 16px;
          align-items: start;
        }

        .poster-wrap {
          width: 126px;
        }

        .poster-image {
          width: 126px;
          aspect-ratio: 2 / 3;
          object-fit: cover;
          border-radius: 16px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.42);
          display: block;
          background: rgba(255,255,255,0.08);
        }

        .title-main h1 {
          padding-top: 6px;
          margin: 0;
          font-size: clamp(28px, 8.5vw, 56px);
          line-height: 0.96;
          letter-spacing: -0.04em;
          font-weight: 900;
        }

        .title-year {
          opacity: 0.58;
          font-weight: 700;
        }

        .title-credits {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 14px;
          color: rgba(255,255,255,0.82);
        }

        .inline-link {
          color: white;
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.22);
        }

        .meta-line {
          margin-top: 10px;
          color: rgba(255,255,255,0.65);
          font-size: 14px;
        }

        .genres {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 13px;
          color: rgba(255,255,255,0.92);
          text-decoration: none;
          white-space: nowrap;
        }

        .hero-stats {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 18px 0 6px 0;
          margin-top: 14px;
          -webkit-overflow-scrolling: touch;
        }

        .hero-stat {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          min-height: 52px;
          padding: 0 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 14px;
          line-height: 1;
          color: rgba(255,255,255,0.95);
          white-space: nowrap;
        }

        .action-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: ${BRAND};
          color: white;
          text-decoration: none;
          padding: 12px 16px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 14px;
        }

        .bubble-tabs {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 18px 0 2px 0;
          margin-top: 24px;
          -webkit-overflow-scrolling: touch;
        }

        .tab-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border-radius: 999px;
          text-decoration: none;
          white-space: nowrap;
          font-size: 14px;
          font-weight: 700;
          color: white;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.05);
        }

        .tab-pill.active {
          background: ${BRAND};
          border-color: ${BRAND};
        }

        .section-block {
          margin-top: 30px;
        }

        .section-title {
          margin: 0 0 14px 0;
          font-size: 28px;
          line-height: 1.02;
          letter-spacing: -0.03em;
          font-weight: 900;
        }

        .overview-text {
          margin: 0;
          color: rgba(255,255,255,0.78);
          font-size: 16px;
          line-height: 1.75;
          max-width: 820px;
        }

        .providers-row,
        .watchers-row {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .provider-logo {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          object-fit: cover;
          background: rgba(255,255,255,0.07);
        }

        .watcher-link {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          min-width: 56px;
          text-decoration: none;
          color: white;
        }

        .watcher-avatar,
        .watcher-fallback {
          width: 48px;
          height: 48px;
          border-radius: 999px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          display: block;
        }

        .watcher-name {
          font-size: 11px;
          opacity: 0.72;
          text-align: center;
          line-height: 1.25;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .person-card {
          display: block;
          text-decoration: none;
          color: white;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          overflow: hidden;
        }

        .person-photo,
        .person-photo-fallback {
          width: 100%;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
        }

        .person-body {
          padding: 12px;
        }

        .person-name {
          font-size: 14px;
          font-weight: 800;
          line-height: 1.35;
        }

        .person-sub {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255,255,255,0.62);
          line-height: 1.35;
        }

        .comment-list {
          display: grid;
          gap: 12px;
        }

        .comment-card {
          display: flex;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .comment-avatar,
        .comment-avatar-fallback {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          flex-shrink: 0;
        }

        .comment-user {
          font-weight: 800;
          font-size: 14px;
        }

        .comment-rating {
          margin-top: 2px;
          color: rgba(255,255,255,0.58);
          font-size: 12px;
        }

        .comment-content {
          margin-top: 6px;
          color: rgba(255,255,255,0.78);
          font-size: 14px;
          line-height: 1.6;
        }

        @media (min-width: 900px) {
          .hero-backdrop {
            height: 400px;
            border-radius: 0 0 28px 28px;
          }

          .title-shell {
            padding: 0 28px 48px 28px;
          }

          .title-header {
            margin-top: -120px;
            grid-template-columns: 220px 1fr;
            gap: 30px;
          }

          .poster-wrap {
            width: 220px;
          }

          .poster-image {
            width: 220px;
            border-radius: 18px;
          }

          .title-credits {
            font-size: 16px;
          }

          .meta-line {
            font-size: 15px;
          }

          .hero-stats {
            display: flex;
            flex-wrap: wrap;
            overflow: visible;
            padding: 18px 0 0 0;
          }

          .cards-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 18px;
          }
        }
      `}</style>

      <div className="title-page">
        {backdrop ? (
          <div className="hero-backdrop">
            <Image
              src={`${IMG}${backdrop}`}
              alt={title}
              fill
              priority
              unoptimized
              sizes="100vw"
              style={{ objectFit: "cover", opacity: 0.42 }}
            />
            <div className="hero-backdrop-overlay" />
          </div>
        ) : null}

        <div className="title-shell">
          <div className="title-header">
            <div className="poster-wrap">
              {poster ? (
                <Image
                  src={`${POSTER}${poster}`}
                  alt={title}
                  width={220}
                  height={330}
                  className="poster-image"
                  unoptimized
                />
              ) : (
                <div className="poster-image" />
              )}
            </div>

            <div className="title-main">
              <h1>
                {title} {year ? <span className="title-year">({year})</span> : null}
              </h1>

              <div className="title-credits">
                {director ? (
                  <div>
                    {t.directedBy}{" "}
                    <Link
                      href={personHref(director.id, director.name)}
                      className="inline-link"
                    >
                      {director.name}
                    </Link>
                  </div>
                ) : null}

                {!director && creator ? (
                  <div>
                    {t.createdBy}{" "}
                    <Link
                      href={personHref(creator.id, creator.name)}
                      className="inline-link"
                    >
                      {creator.name}
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="meta-line">
                {runtime ? `⏱ ${runtime} ${t.min}` : ""}
              </div>

              <div className="genres">
                {(data.genres || []).map((g) => (
                  <span key={g.id} className="pill">
                    {g.name}
                  </span>
                ))}
              </div>

              <div className="action-row">
                {trailer ? (
                  <Link
                    href={`https://youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    className="btn-primary"
                  >
                    ▶ {t.watchTrailer}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">⭐ {stats.avgRating ?? "-"} · {t.peekrRating}</div>
            <div className="hero-stat">👁 {stats.watchedCount ?? 0} {t.watched}</div>
            <div className="hero-stat">💬 {stats.commentsCount ?? 0} {t.commentsCount}</div>
            <div className="hero-stat">👀 {stats.viewsCount ?? 0} {t.views}</div>
          </div>

          <div className="bubble-tabs">
            <Link
              href={tabHref("overview")}
              scroll={false}
              className={`tab-pill ${activeTab === "overview" ? "active" : ""}`}
            >
              {t.tabsOverview}
            </Link>
            <Link
              href={tabHref("cast")}
              scroll={false}
              className={`tab-pill ${activeTab === "cast" ? "active" : ""}`}
            >
              {t.tabsCast}
            </Link>
            <Link
              href={tabHref("crew")}
              scroll={false}
              className={`tab-pill ${activeTab === "crew" ? "active" : ""}`}
            >
              {t.tabsCrew}
            </Link>
            <Link
              href={tabHref("awards")}
              scroll={false}
              className={`tab-pill ${activeTab === "awards" ? "active" : ""}`}
            >
              {t.tabsAwards}
            </Link>
            {providers.length > 0 ? (
              <Link
                href={tabHref("platforms")}
                scroll={false}
                className={`tab-pill ${activeTab === "platforms" ? "active" : ""}`}
              >
                {t.tabsPlatforms}
              </Link>
            ) : null}
            {comments.length > 0 ? (
              <Link
                href={tabHref("comments")}
                scroll={false}
                className={`tab-pill ${activeTab === "comments" ? "active" : ""}`}
              >
                {t.tabsComments}
              </Link>
            ) : null}
          </div>

          {activeTab === "overview" ? (
            <>
              <section className="section-block">
                <h2 className="section-title">{t.overview}</h2>
                <p className="overview-text">{data.overview || t.noOverview}</p>
              </section>

              {providers.length > 0 ? (
                <section className="section-block">
                  <h2 className="section-title">{t.whereToWatch}</h2>
                  <div className="providers-row">
                    {providers.map((p) => (
                      <div key={p.provider_id} className="watcher-link">
                        <Image
                          src={`${PROVIDER}${p.logo_path}`}
                          alt={p.provider_name}
                          width={50}
                          height={50}
                          className="provider-logo"
                          unoptimized
                        />
                        <div className="watcher-name">{p.provider_name}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {watchers.length > 0 ? (
                <section className="section-block">
                  <h2 className="section-title">{t.usersWhoWatched}</h2>
                  <div className="watchers-row">
                    {watchers.map((w) => (
                      <Link
                        key={w.user_id}
                        href={userHref(w.username)}
                        className="watcher-link"
                      >
                        {w.avatar_url ? (
                          <Image
                            src={w.avatar_url}
                            alt={w.username || ""}
                            width={48}
                            height={48}
                            className="watcher-avatar"
                            unoptimized
                          />
                        ) : (
                          <div className="watcher-fallback" />
                        )}
                        <div className="watcher-name">{w.username || "user"}</div>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {activeTab === "cast" ? (
            <section className="section-block">
              <h2 className="section-title">{t.cast}</h2>
              <div className="cards-grid">
                {cast.map((c) => (
                  <Link
                    key={c.id}
                    href={personHref(c.id, c.name)}
                    className="person-card"
                  >
                    {c.profile_path ? (
                      <Image
                        src={`${PERSON}${c.profile_path}`}
                        alt={c.name}
                        width={185}
                        height={246}
                        className="person-photo"
                        unoptimized
                      />
                    ) : (
                      <div className="person-photo-fallback" />
                    )}

                    <div className="person-body">
                      <div className="person-name">{c.name}</div>
                      <div className="person-sub">{c.character || ""}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "crew" ? (
            <section className="section-block">
              <h2 className="section-title">{t.crew}</h2>
              <div className="cards-grid">
                {crew.map((c) => (
                  <Link
                    key={`${c.id}-${c.job || ""}`}
                    href={personHref(c.id, c.name)}
                    className="person-card"
                  >
                    {c.profile_path ? (
                      <Image
                        src={`${PERSON}${c.profile_path}`}
                        alt={c.name}
                        width={185}
                        height={246}
                        className="person-photo"
                        unoptimized
                      />
                    ) : (
                      <div className="person-photo-fallback" />
                    )}

                    <div className="person-body">
                      <div className="person-name">{c.name}</div>
                      <div className="person-sub">{c.job || ""}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "platforms" && providers.length > 0 ? (
            <section className="section-block">
              <h2 className="section-title">{t.whereToWatch}</h2>
              <div className="providers-row">
                {providers.map((p) => (
                  <div key={p.provider_id} className="watcher-link">
                    <Image
                      src={`${PROVIDER}${p.logo_path}`}
                      alt={p.provider_name}
                      width={50}
                      height={50}
                      className="provider-logo"
                      unoptimized
                    />
                    <div className="watcher-name">{p.provider_name}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "awards" ? (
            <section className="section-block">
              <h2 className="section-title">{t.awards}</h2>
              <p className="overview-text">{t.noAwards}</p>
            </section>
          ) : null}

          {activeTab === "comments" && comments.length > 0 ? (
            <section className="section-block">
              <h2 className="section-title">{t.comments}</h2>

              <div className="comment-list">
                {comments.map((c) => (
                  <div key={c.id} className="comment-card">
                    {c.avatar_url ? (
                      <Image
                        src={c.avatar_url}
                        alt={c.username || ""}
                        width={42}
                        height={42}
                        className="comment-avatar"
                        unoptimized
                      />
                    ) : (
                      <div className="comment-avatar-fallback" />
                    )}

                    <div>
                      <div className="comment-user">{c.username || "user"}</div>
                      {typeof c.rating === "number" ? (
                        <div className="comment-rating">⭐ {c.rating}/10</div>
                      ) : null}
                      <div className="comment-content">{c.content || ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
