export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";

type Params = {
  type: "movie" | "tv";
  id: string;
};

type Props = {
  params: Promise<Params>;
};

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

async function fetchJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  return res.json();
}

async function getTitle(type: string, id: string) {
  return fetchJson(
    `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_KEY}&language=en-US`
  );
}

async function getCredits(type: string, id: string) {
  return fetchJson(
    `${TMDB_BASE}/${type}/${id}/credits?api_key=${TMDB_KEY}&language=en-US`
  );
}

async function getWatchProviders(type: string, id: string) {
  return fetchJson(
    `${TMDB_BASE}/${type}/${id}/watch/providers?api_key=${TMDB_KEY}`
  );
}

async function getMovieReleaseDates(id: string) {
  return fetchJson(
    `${TMDB_BASE}/movie/${id}/release_dates?api_key=${TMDB_KEY}`
  );
}

async function getTvContentRatings(id: string) {
  return fetchJson(
    `${TMDB_BASE}/tv/${id}/content_ratings?api_key=${TMDB_KEY}`
  );
}

async function getPeekrRating(tmdbId: number) {
  const { data, error } = await supabase.rpc("avg_rating_for_title", {
    tmdbid: tmdbId,
  });

  if (error || data == null) return null;

  const rating = Number(data) / 2;
  return Number(rating.toFixed(1));
}

function getYear(data: any) {
  return (
    data?.release_date?.split("-")[0] ||
    data?.first_air_date?.split("-")[0] ||
    null
  );
}

function getGenres(data: any) {
  if (!data?.genres) return [];
  return data.genres.map((g: any) => g.name).filter(Boolean);
}

function getDirectorOrCreator(type: string, data: any, credits: any) {
  if (type === "tv") {
    const creators = data?.created_by?.map((p: any) => p.name).filter(Boolean) || [];
    return creators.length ? creators.join(", ") : null;
  }

  const directors =
    credits?.crew
      ?.filter((person: any) => person.job === "Director")
      ?.map((person: any) => person.name)
      ?.filter(Boolean) || [];

  return directors.length ? directors.join(", ") : null;
}

function getTopCast(credits: any) {
  return (credits?.cast || []).slice(0, 8);
}

function getParentalRating(type: string, releaseData: any, contentRatings: any) {
  if (type === "movie") {
    const usEntry = releaseData?.results?.find((r: any) => r.iso_3166_1 === "US");
    const certification =
      usEntry?.release_dates?.find((x: any) => x.certification)?.certification || null;
    return certification || null;
  }

  const usEntry = contentRatings?.results?.find((r: any) => r.iso_3166_1 === "US");
  return usEntry?.rating || null;
}

function getPlatforms(providersData: any) {
  const ar =
    providersData?.results?.AR?.flatrate ||
    providersData?.results?.AR?.buy ||
    providersData?.results?.AR?.rent ||
    [];

  const mx =
    providersData?.results?.MX?.flatrate ||
    providersData?.results?.MX?.buy ||
    providersData?.results?.MX?.rent ||
    [];

  const us =
    providersData?.results?.US?.flatrate ||
    providersData?.results?.US?.buy ||
    providersData?.results?.US?.rent ||
    [];

  const all = [...ar, ...mx, ...us];

  const unique = all.filter(
    (item: any, index: number, self: any[]) =>
      index === self.findIndex((x: any) => x.provider_id === item.provider_id)
  );

  return unique.slice(0, 8);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, id } = await params;
  const data = await getTitle(type, id);

  if (!data) {
    return {
      title: "Peekr",
      description: "Discover movies & TV shows on Peekr",
    };
  }

  const title = data.title || data.name;
  const poster = data.poster_path
    ? `https://image.tmdb.org/t/p/w780${data.poster_path}`
    : undefined;

  return {
    title: `${title} | Peekr`,
    description: data.overview || "Discover movies & TV shows on Peekr",
    openGraph: {
      title: `${title} | Peekr`,
      description: data.overview || "Discover movies & TV shows on Peekr",
      url: `https://peekr.app/title/${type}/${id}`,
      images: poster ? [poster] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Peekr`,
      description: data.overview || "Discover movies & TV shows on Peekr",
      images: poster ? [poster] : [],
    },
  };
}

export default async function TitlePage({ params }: Props) {
  const { type, id } = await params;

  const [data, credits, providersData, movieReleaseDates, tvContentRatings, rating] =
    await Promise.all([
      getTitle(type, id),
      getCredits(type, id),
      getWatchProviders(type, id),
      type === "movie" ? getMovieReleaseDates(id) : Promise.resolve(null),
      type === "tv" ? getTvContentRatings(id) : Promise.resolve(null),
      getPeekrRating(Number(id)),
    ]);

  if (!data) {
    return <div className="p-10 text-white">Not found</div>;
  }

  const title = data.title || data.name;
  const poster = data.poster_path
    ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
    : null;

  const year = getYear(data);
  const genres = getGenres(data);
  const parental = getParentalRating(type, movieReleaseDates, tvContentRatings);
  const directorOrCreator = getDirectorOrCreator(type, data, credits);
  const cast = getTopCast(credits);
  const platforms = getPlatforms(providersData);

  return (
    <main className="min-h-screen bg-black text-white px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="md:w-[320px] md:flex-shrink-0">
            {poster ? (
              <img
                src={poster}
                alt={title}
                className="w-full rounded-2xl object-cover shadow-2xl"
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center rounded-2xl bg-white/10 text-white/50">
                No poster
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              {title}
            </h1>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/70 md:text-base">
              {genres.length > 0 && <span>{genres.join(" • ")}</span>}
              {year && <span>• {year}</span>}
              {parental && <span>• {parental}</span>}
            </div>

            <div className="mt-5">
              <div className="text-lg font-semibold text-yellow-400">
                {rating ? `⭐ ${rating} Peekr rating` : "No ratings yet on Peekr"}
              </div>
            </div>

            {directorOrCreator && (
              <div className="mt-6">
                <div className="text-sm uppercase tracking-wide text-white/50">
                  {type === "tv" ? "Creator" : "Director"}
                </div>
                <div className="mt-1 text-lg text-white">{directorOrCreator}</div>
              </div>
            )}

            {data.overview && (
              <div className="mt-6">
                <div className="text-sm uppercase tracking-wide text-white/50">
                  Synopsis
                </div>
                <p className="mt-2 max-w-3xl text-base leading-7 text-white/85 md:text-lg">
                  {data.overview}
                </p>
              </div>
            )}

            {cast.length > 0 && (
              <div className="mt-8">
                <div className="text-sm uppercase tracking-wide text-white/50">
                  Cast
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {cast.map((person: any) => (
                    <div
                      key={person.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="font-medium text-white">{person.name}</div>
                      {person.character && (
                        <div className="mt-1 text-sm text-white/60">
                          {person.character}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {platforms.length > 0 && (
              <div className="mt-8">
                <div className="text-sm uppercase tracking-wide text-white/50">
                  Platforms
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {platforms.map((provider: any) => (
                    <div
                      key={provider.provider_id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      {provider.logo_path && (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                          alt={provider.provider_name}
                          className="h-8 w-8 rounded-md"
                        />
                      )}
                      <span className="text-sm text-white/85">
                        {provider.provider_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8">
              <a
                href={process.env.NEXT_PUBLIC_TESTFLIGHT_URL || "#"}
                className="inline-block rounded-xl bg-white px-5 py-3 font-semibold text-black"
              >
                Open in Peekr
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
//force deploy
