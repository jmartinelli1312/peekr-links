/**
 * Title reel — fact gathering. Pulls the hard data the script is allowed to
 * cite: TMDB (overview, genres, runtime/seasons, certification, AR streaming
 * platforms, official trailer key) + Peekr (rating avg/count, comments).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReelFacts } from "./script";

const TMDB = "https://api.themoviedb.org/3";
const PROVIDER_COUNTRY = "AR";

export interface ReelSource extends ReelFacts {
  trailerKey: string | null;   // YouTube video id (official trailer)
  posterPath: string | null;
  backdropPath: string | null;
}

export async function gatherReelFacts(
  admin: SupabaseClient,
  tmdbId: number,
  mediaType: "movie" | "tv",
  tmdbKey: string,
): Promise<ReelSource> {
  // ── TMDB: details + videos + providers + release dates (certification) ──
  const append = mediaType === "movie"
    ? "videos,watch/providers,release_dates"
    : "videos,watch/providers,content_ratings";
  const res = await fetch(
    `${TMDB}/${mediaType}/${tmdbId}?api_key=${tmdbKey}&language=es-ES&include_video_language=es,en&append_to_response=${append}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${mediaType}/${tmdbId}`);
  const j = (await res.json()) as Record<string, unknown>;

  const title = (j.title as string) ?? (j.name as string) ?? `#${tmdbId}`;
  const dateStr = ((j.release_date as string) ?? (j.first_air_date as string) ?? "") as string;
  const year = parseInt(dateStr.slice(0, 4), 10) || null;
  const genres = ((j.genres as Array<{ name: string }>) ?? []).map((g) => g.name);
  const runtimeMin = mediaType === "movie" ? ((j.runtime as number) ?? null) : null;
  const seasons = mediaType === "tv" ? ((j.number_of_seasons as number) ?? null) : null;

  // Certification: US rating is the most recognisable (PG-13 etc.).
  let certification: string | null = null;
  if (mediaType === "movie") {
    const rd = (j.release_dates as { results?: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> })?.results ?? [];
    const us = rd.find((r) => r.iso_3166_1 === "US");
    certification = us?.release_dates?.find((d) => d.certification)?.certification || null;
  } else {
    const cr = (j.content_ratings as { results?: Array<{ iso_3166_1: string; rating: string }> })?.results ?? [];
    certification = cr.find((r) => r.iso_3166_1 === "US")?.rating || null;
  }

  // Platforms (AR): flatrate → free → ads.
  const region = (j["watch/providers"] as { results?: Record<string, { flatrate?: Array<{ provider_name: string }>; free?: Array<{ provider_name: string }>; ads?: Array<{ provider_name: string }> }> })
    ?.results?.[PROVIDER_COUNTRY];
  const platforms = (region?.flatrate ?? region?.free ?? region?.ads ?? []).map((p) => p.provider_name);

  // Official trailer: prefer ES, then EN; Trailer > Teaser; official flag first.
  const vids = ((j.videos as { results?: Array<{ key: string; site: string; type: string; official: boolean; iso_639_1: string }> })?.results ?? [])
    .filter((v) => v.site === "YouTube");
  const rank = (v: typeof vids[number]) =>
    (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 1 : 2) * 10
    + (v.official ? 0 : 5)
    + (v.iso_639_1 === "es" ? 0 : v.iso_639_1 === "en" ? 1 : 2);
  vids.sort((a, b) => rank(a) - rank(b));
  const trailerKey = vids[0]?.key ?? null;

  // ── Peekr: rating avg/count + comments (all-time for the verdict) ────────
  const [{ data: ratingRows }, { count: comments }] = await Promise.all([
    admin.from("user_title_activities").select("rating").eq("tmdb_id", tmdbId).eq("media_type", mediaType).not("rating", "is", null),
    admin.from("comments").select("id", { count: "exact", head: true }).eq("tmdb_id", tmdbId).not("comment", "is", null),
  ]);
  const ratings = ((ratingRows ?? []) as Array<{ rating: number }>).map((r) => Number(r.rating)).filter((n) => n > 0);
  const peekrRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

  return {
    title,
    mediaType,
    year,
    overview: (j.overview as string) ?? "",
    genres,
    runtimeMin,
    seasons,
    certification,
    platforms,
    peekrRating,
    peekrRatingCount: ratings.length,
    peekrComments: comments ?? 0,
    trailerKey,
    posterPath: (j.poster_path as string) ?? null,
    backdropPath: (j.backdrop_path as string) ?? null,
  };
}
