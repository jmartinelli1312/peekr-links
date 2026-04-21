/**
 * Shared types and helpers for every Peekr Buzz programmatic-SEO
 * template. Each template file imports only from here so we don't
 * pull in unrelated state or create circular imports.
 */

const TMDB_KEY = process.env.TMDB_API_KEY!;
export const TMDB_BASE = "https://api.themoviedb.org/3";

export type Lang = "es" | "en" | "pt";
export const LANGS: Lang[] = ["es", "en", "pt"];

export type TmdbTitle = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  media_type: "movie" | "tv";
  vote_average?: number | null;
  genres?: { id: number; name: string }[];
};

export type GeneratedArticle = {
  slug: string;
  title: string;
  summary: string;
  body_html: string;
  image_url: string | null;
  category: string;
  source_name: string;
  language: Lang;
  topic_key: string;
};

export type DailyArticleBatch = {
  template: string;           // e.g. "weekly-releases"
  topic: string;              // human-readable, for logs/response
  articles: GeneratedArticle[]; // up to 3 (one per language)
};

// ============================================================
// DATE / SLUG HELPERS
// ============================================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function yearMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

export function yearMonthDay(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns ISO 8601 week number 1-53 for rotating weekly content.
 * Based on Thursday of the target week per ISO rules.
 */
export function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** ISO week year (may differ from calendar year for week 1/53 edge cases). */
export function isoWeekYear(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/** Combined "2026-W17" style stamp for weekly-scoped topic keys. */
export function isoYearWeek(date: Date): string {
  const y = isoWeekYear(date);
  const w = String(isoWeek(date)).padStart(2, "0");
  return `${y}-W${w}`;
}

// ============================================================
// HTML / TEXT HELPERS
// ============================================================

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function titleYear(t: TmdbTitle): string {
  const raw = t.release_date || t.first_air_date || "";
  return raw ? raw.slice(0, 4) : "";
}

export function internalTitleUrl(t: TmdbTitle, lang: Lang): string {
  const type = t.media_type === "tv" ? "tv" : "movie";
  return `/${lang}/title/${type}/${t.id}-${slugify(t.title || "title")}`;
}

/** Picks the best image available for the hero image_url field. */
export function pickHeroImage(t: TmdbTitle): string | null {
  if (t.backdrop_path) return `https://image.tmdb.org/t/p/w1280${t.backdrop_path}`;
  if (t.poster_path) return `https://image.tmdb.org/t/p/w780${t.poster_path}`;
  return null;
}

// ============================================================
// TMDB HELPERS
// ============================================================

export function tmdbLangCode(lang: Lang): string {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}

export function tmdbRegion(lang: Lang): string {
  if (lang === "es") return "AR";
  if (lang === "pt") return "BR";
  return "US";
}

/**
 * Low-level fetch wrapper for TMDB endpoints. Returns null on any
 * failure (non-200, network error) so templates can continue with
 * whatever data they did manage to load.
 */
export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T | null> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Narrows a raw TMDB list item to our TmdbTitle shape. */
export function normalizeTmdbItem(
  raw: {
    id: number;
    title?: string;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string | null;
    first_air_date?: string | null;
    vote_average?: number | null;
    media_type?: string;
  },
  fallbackType: "movie" | "tv"
): TmdbTitle {
  const media_type: "movie" | "tv" =
    raw.media_type === "tv" ? "tv" : raw.media_type === "movie" ? "movie" : fallbackType;
  return {
    id: raw.id,
    title: raw.title || raw.name || "Untitled",
    overview: raw.overview || "",
    poster_path: raw.poster_path ?? null,
    backdrop_path: raw.backdrop_path ?? null,
    release_date: raw.release_date ?? null,
    first_air_date: raw.first_air_date ?? null,
    media_type,
    vote_average: raw.vote_average ?? null,
  };
}

// ============================================================
// SHARED ARTICLE-ASSEMBLY HELPERS
// ============================================================

export type RecStrings = {
  mediaTypeMovie: string;
  mediaTypeTv: string;
  yearLabel: string;
  overviewFallback: string;
};

/**
 * Renders one H3 + meta + overview block linking to the internal
 * title page. Used by every template that lists recommended titles.
 */
export function renderRecBlock(
  t: TmdbTitle,
  lang: Lang,
  strings: RecStrings
): string {
  const year = titleYear(t);
  const mediaLabel =
    t.media_type === "tv" ? strings.mediaTypeTv : strings.mediaTypeMovie;
  const overview = t.overview.trim() || strings.overviewFallback;

  return [
    `<h3><a href="${internalTitleUrl(t, lang)}">${escapeHtml(t.title)}</a>${year ? ` <span>(${escapeHtml(year)})</span>` : ""}</h3>`,
    `<p><strong>${escapeHtml(mediaLabel)}${year ? ` · ${escapeHtml(strings.yearLabel)} ${escapeHtml(year)}` : ""}</strong></p>`,
    `<p>${escapeHtml(overview)}</p>`,
  ].join("\n");
}

/**
 * Composes a full article body from ordered section pieces. Each piece
 * is either an HTML string (pre-rendered) or null (skipped).
 */
export function composeArticleBody(sections: (string | null | undefined)[]): string {
  return sections.filter((s): s is string => !!s && s.length > 0).join("\n\n");
}
