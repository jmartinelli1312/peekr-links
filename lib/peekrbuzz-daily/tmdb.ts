/**
 * TMDB lookups used to verify that Gemini-identified entities (titles + people)
 * are recognisable, famous things. Anything we can't find on TMDB — or with
 * popularity below the threshold — is treated as not viral-worthy and dropped.
 */

const TMDB_BASE = "https://api.themoviedb.org/3";

export type EntityType = "title" | "person";

export interface EntityMatch {
  query: string;
  type: EntityType;
  tmdb_id: number;
  resolved_name: string;
  popularity: number;
  /** For titles: backdrop or poster URL when available; null for people. */
  image_url: string | null;
  media_type?: "movie" | "tv" | "person";
}

interface TmdbSearchResult {
  id: number;
  name?: string;
  title?: string;
  popularity?: number;
  media_type?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  profile_path?: string | null;
}

/**
 * Searches TMDB's /search/multi for a string and returns the best match
 * filtered by type. "Best" = highest popularity that matches the target type.
 *
 * Returns null on:
 *   - no API key
 *   - HTTP error
 *   - no results matching the requested type
 *   - top match's popularity below `minPopularity`
 */
export async function searchTmdbEntity(
  query: string,
  type: EntityType,
  apiKey: string,
  minPopularity = 10,
): Promise<EntityMatch | null> {
  if (!apiKey || !query) return null;
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  try {
    const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(trimmed)}&api_key=${apiKey}&language=es-ES&page=1&include_adult=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: TmdbSearchResult[] };
    const results = data.results ?? [];

    // Filter by entity type. TMDB media_type is 'movie' | 'tv' | 'person'.
    const targetTypes = type === "person" ? ["person"] : ["movie", "tv"];
    const matches = results.filter((r) => r.media_type && targetTypes.includes(r.media_type));
    if (matches.length === 0) return null;

    // Highest popularity wins.
    matches.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    const best = matches[0];
    const pop = best.popularity ?? 0;
    if (pop < minPopularity) return null;

    const resolvedName = best.title ?? best.name ?? trimmed;
    const image = imageUrlFor(best);

    return {
      query: trimmed,
      type,
      tmdb_id: best.id,
      resolved_name: resolvedName,
      popularity: pop,
      image_url: image,
      media_type: best.media_type as "movie" | "tv" | "person",
    };
  } catch {
    return null;
  }
}

function imageUrlFor(r: TmdbSearchResult): string | null {
  if (r.backdrop_path) return `https://image.tmdb.org/t/p/w1280${r.backdrop_path}`;
  if (r.poster_path) return `https://image.tmdb.org/t/p/w780${r.poster_path}`;
  if (r.profile_path) return `https://image.tmdb.org/t/p/w500${r.profile_path}`;
  return null;
}

/**
 * Verifies a batch of candidate entities against TMDB in parallel. Returns the
 * subset that resolved with sufficient popularity, sorted by popularity desc.
 */
export async function verifyEntitiesAgainstTmdb(
  candidates: Array<{ query: string; type: EntityType }>,
  apiKey: string,
  minPopularity = 10,
): Promise<EntityMatch[]> {
  const results = await Promise.all(
    candidates.map((c) => searchTmdbEntity(c.query, c.type, apiKey, minPopularity)),
  );
  return results
    .filter((m): m is EntityMatch => m !== null)
    .sort((a, b) => b.popularity - a.popularity);
}
