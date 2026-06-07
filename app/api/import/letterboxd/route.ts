import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Resolves Letterboxd films (title + year — Letterboxd does NOT export a
// tmdb_id) to TMDB movie ids via /search/movie. Letterboxd is movies-only,
// so we never search TV. Returns a confidence flag the UI uses to decide
// which matches need manual review before import.

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_FILMS = 1500; // safety cap per request
const CONCURRENCY = 10;

type InFilm = { id: string; title: string; year: number | null };
type OutFilm = {
  id: string;
  tmdb_id: number | null;
  matched_title: string | null;
  poster_path: string | null;
  release_year: number | null;
  confidence: "high" | "medium" | "low" | "none";
};

function tmdbLanguage(lang: string) {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function resolveOne(film: InFilm, apiLang: string): Promise<OutFilm> {
  const base: OutFilm = {
    id: film.id,
    tmdb_id: null,
    matched_title: null,
    poster_path: null,
    release_year: null,
    confidence: "none",
  };

  const title = (film.title || "").trim();
  if (!title) return base;

  try {
    const yearParam = film.year ? `&year=${film.year}` : "";
    const url =
      `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&language=${apiLang}` +
      `&query=${encodeURIComponent(title)}${yearParam}&include_adult=false`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    const data = await res.json();
    const results: any[] = data?.results ?? [];
    if (results.length === 0) return base;

    const wantTitle = norm(title);
    const wantYear = film.year;

    // Score candidates: exact normalized title + matching year = high.
    let best = results[0];
    let bestScore = -1;
    for (const r of results.slice(0, 8)) {
      const rTitle = norm(r.title || r.original_title || "");
      const rYear = r.release_date ? Number(r.release_date.slice(0, 4)) : null;
      let score = 0;
      if (rTitle === wantTitle) score += 3;
      else if (rTitle.includes(wantTitle) || wantTitle.includes(rTitle)) score += 1;
      if (wantYear && rYear && Math.abs(rYear - wantYear) === 0) score += 2;
      else if (wantYear && rYear && Math.abs(rYear - wantYear) === 1) score += 1;
      score += Math.min(1, (r.popularity || 0) / 50);
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }

    const bestTitle = norm(best.title || best.original_title || "");
    const bestYear = best.release_date ? Number(best.release_date.slice(0, 4)) : null;
    const titleExact = bestTitle === wantTitle;
    const yearExact = !!(wantYear && bestYear && wantYear === bestYear);

    let confidence: OutFilm["confidence"];
    if (titleExact && (yearExact || !wantYear)) confidence = "high";
    else if (titleExact || yearExact) confidence = "medium";
    else confidence = "low";

    return {
      id: film.id,
      tmdb_id: best.id,
      matched_title: best.title || best.original_title || null,
      poster_path: best.poster_path || null,
      release_year: bestYear,
      confidence,
    };
  } catch {
    return base;
  }
}

export async function POST(req: NextRequest) {
  let body: { films?: InFilm[]; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const films = (body.films ?? []).slice(0, MAX_FILMS);
  const apiLang = tmdbLanguage(body.lang || "es");

  if (!Array.isArray(films) || films.length === 0) {
    return NextResponse.json({ matches: [], truncated: false });
  }

  // Bounded-concurrency pool to avoid hammering TMDB.
  const out: OutFilm[] = new Array(films.length);
  let cursor = 0;
  async function worker() {
    while (cursor < films.length) {
      const i = cursor++;
      out[i] = await resolveOne(films[i], apiLang);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, films.length) }, () => worker())
  );

  return NextResponse.json({
    matches: out,
    truncated: (body.films?.length ?? 0) > MAX_FILMS,
  });
}
