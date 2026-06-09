import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Resolves a CHUNK of distinct Netflix titles (already parsed/collapsed
// client-side) to TMDB ids. Netflix gives English titles and no tmdb_id, so we
// search en-US. Series are collapsed to the show; movies/ambiguous handled with
// fallbacks. The client sends titles in chunks to stay well under the function
// timeout. Confidence: high = exact title match; medium = strong top result;
// none = nothing. Only "high" lands in the review table by default.

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_PER_REQUEST = 200;
const CONCURRENCY = 12;
const MIN_VOTES_FOR_MEDIUM = 40;

type InTitle = {
  key: string;
  type: "tv" | "movie" | "ambiguous";
  name: string;        // show name (tv/ambiguous) or movie title
  fullName?: string;   // full Netflix string (for ambiguous movie search)
  seasons?: number[];
};
type OutMatch = {
  key: string;
  tmdb_id: number | null;
  media_type: "tv" | "movie" | null;
  matched_title: string | null;
  poster_path: string | null;
  release_year: number | null;
  tmdb_rating: number | null; // TMDB vote_average (0-10), used as the default Peekr rating
  total_seasons: number | null; // for TV: number of real seasons (season_number > 0)
  confidence: "high" | "medium" | "none";
};

// Number of real seasons for a TV show (excludes specials / season 0).
async function tvTotalSeasons(id: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/tv/${id}?api_key=${TMDB_KEY}&language=en-US`,
      { next: { revalidate: 60 * 60 * 24 } }
    );
    const d = await res.json();
    const real = (d?.seasons ?? []).filter((s: any) => (s?.season_number ?? 0) > 0);
    const total = real.length || d?.number_of_seasons || 0;
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function tmdbSearch(kind: "tv" | "movie", q: string): Promise<any[]> {
  if (!q.trim()) return [];
  try {
    const url =
      `${TMDB_BASE}/search/${kind}?api_key=${TMDB_KEY}&language=en-US` +
      `&query=${encodeURIComponent(q)}&include_adult=false`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    const data = await res.json();
    return data?.results ?? [];
  } catch {
    return [];
  }
}

function titleOf(r: any, kind: "tv" | "movie") {
  return kind === "tv" ? r.name || r.original_name : r.title || r.original_title;
}
function yearOf(r: any, kind: "tv" | "movie") {
  const d = kind === "tv" ? r.first_air_date : r.release_date;
  return d ? Number(String(d).slice(0, 4)) : null;
}
function exactMatch(results: any[], q: string, kind: "tv" | "movie") {
  const nq = norm(q);
  for (const r of results.slice(0, 6)) {
    const a = norm(kind === "tv" ? r.name || "" : r.title || "");
    const b = norm(kind === "tv" ? r.original_name || "" : r.original_title || "");
    if (a === nq || b === nq) return r;
  }
  return null;
}
// Fallback: top result that is clearly the same thing (high vote_count + the
// query is contained, e.g. "CSI" -> "CSI: Crime Scene Investigation").
function strongTop(results: any[], q: string, kind: "tv" | "movie") {
  const top = results[0];
  if (!top) return null;
  const nq = norm(q);
  const nt = norm(titleOf(top, kind) || "");
  const contained = nt.startsWith(nq + " ") || nt === nq || nq.startsWith(nt + " ");
  if ((top.vote_count ?? 0) >= MIN_VOTES_FOR_MEDIUM && contained) return top;
  return null;
}

function pack(
  key: string,
  r: any | null,
  kind: "tv" | "movie",
  confidence: OutMatch["confidence"],
  totalSeasons: number | null = null
): OutMatch {
  if (!r) return { key, tmdb_id: null, media_type: null, matched_title: null, poster_path: null, release_year: null, tmdb_rating: null, total_seasons: null, confidence: "none" };
  return {
    key,
    tmdb_id: r.id,
    media_type: kind,
    matched_title: titleOf(r, kind) || null,
    poster_path: r.poster_path || null,
    release_year: yearOf(r, kind),
    tmdb_rating: typeof r.vote_average === "number" && r.vote_average > 0
      ? Math.round(r.vote_average * 10) / 10
      : null,
    total_seasons: totalSeasons,
    confidence,
  };
}

// Pick the matched row/kind/confidence first, then (for TV) enrich with the
// real season count so the client can mark every season watched on import.
async function finalize(key: string, r: any | null, kind: "tv" | "movie", confidence: OutMatch["confidence"]): Promise<OutMatch> {
  if (!r) return pack(key, null, kind, "none");
  const total = kind === "tv" ? await tvTotalSeasons(r.id) : null;
  return pack(key, r, kind, confidence, total);
}

async function resolveOne(t: InTitle): Promise<OutMatch> {
  if (t.type === "movie") {
    const res = await tmdbSearch("movie", t.name);
    const ex = exactMatch(res, t.name, "movie");
    if (ex) return finalize(t.key, ex, "movie", "high");
    const strong = strongTop(res, t.name, "movie");
    if (strong) return finalize(t.key, strong, "movie", "medium");
    return pack(t.key, null, "movie", "none");
  }

  if (t.type === "tv") {
    const res = await tmdbSearch("tv", t.name);
    const ex = exactMatch(res, t.name, "tv");
    if (ex) return finalize(t.key, ex, "tv", "high");
    // misclassified movie watched multiple times -> try movie
    const mres = await tmdbSearch("movie", t.name);
    const mex = exactMatch(mres, t.name, "movie");
    if (mex) return finalize(t.key, mex, "movie", "high");
    const strong = strongTop(res, t.name, "tv");
    if (strong) return finalize(t.key, strong, "tv", "medium");
    return pack(t.key, null, "tv", "none");
  }

  // ambiguous: "Show: Subtitle" — could be a movie (full title) or a show.
  const mres = await tmdbSearch("movie", t.fullName || t.name);
  const mex = exactMatch(mres, t.fullName || t.name, "movie");
  if (mex) return finalize(t.key, mex, "movie", "high");
  const tres = await tmdbSearch("tv", t.name);
  const tex = exactMatch(tres, t.name, "tv");
  if (tex) return finalize(t.key, tex, "tv", "high");
  return pack(t.key, null, "tv", "none");
}

export async function POST(req: NextRequest) {
  let body: { titles?: InTitle[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const titles = (body.titles ?? []).slice(0, MAX_PER_REQUEST);
  if (!Array.isArray(titles) || titles.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const out: OutMatch[] = new Array(titles.length);
  let cursor = 0;
  async function worker() {
    while (cursor < titles.length) {
      const i = cursor++;
      out[i] = await resolveOne(titles[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, titles.length) }, () => worker()));

  return NextResponse.json({ matches: out, truncated: (body.titles?.length ?? 0) > MAX_PER_REQUEST });
}
