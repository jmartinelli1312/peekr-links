/**
 * Programmatic SEO — auto-generates Peekr Buzz articles from Peekr's own
 * engagement data plus TMDB metadata. Produces three language variants
 * per topic (ES/EN/PT) that link back to internal title pages for
 * internal-link-equity and community-driven context.
 *
 * Public API:
 *   findTrendingTitle()
 *   fetchTmdbDetails(tmdb_id, media_type, lang)
 *   fetchTmdbRecommendations(tmdb_id, media_type, lang)
 *   renderWhatToWatchAfter(trending, recs, lang)
 */

import { getSupabaseAdmin } from "./supabase-admin";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

export type Lang = "es" | "en" | "pt";

export type TrendingTitle = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  recent_activity_count: number;
};

export type TmdbTitle = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genres?: { id: number; name: string }[];
  media_type: "movie" | "tv";
  vote_average?: number | null;
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

// ============================================================
// SLUG / FORMAT HELPERS
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

function yearMonth(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function tmdbLangCode(lang: Lang): string {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titleDisplayName(t: TmdbTitle): string {
  return t.title;
}

function titleYear(t: TmdbTitle): string {
  const raw = t.release_date || t.first_air_date || "";
  return raw ? raw.slice(0, 4) : "";
}

function internalTitleUrl(t: TmdbTitle, lang: Lang): string {
  const type = t.media_type === "tv" ? "tv" : "movie";
  return `/${lang}/title/${type}/${t.id}-${slugify(t.title || "title")}`;
}

// ============================================================
// DATA FETCHERS
// ============================================================

/**
 * Picks the single most-active title in the last 24 hours of Peekr
 * activity. Ties broken by most-recent activity. Returns null if no
 * activity in the window.
 */
export async function findTrendingTitle(): Promise<TrendingTitle | null> {
  // Uses the service-role client because user_title_activities has RLS
  // policies scoped per user and is invisible to the anon key.
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await admin
    .from("user_title_activities")
    .select("tmdb_id, media_type")
    .gte("watched_at", since)
    .not("tmdb_id", "is", null)
    .limit(2000);

  if (!data || data.length === 0) {
    // Fallback: use the most-recently-updated row in titles_cache so
    // the cron still produces content on cold-start days.
    const { data: fallback } = await admin
      .from("titles_cache")
      .select("tmdb_id, media_type")
      .not("tmdb_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    const row = fallback?.[0] as { tmdb_id: number; media_type: string } | undefined;
    if (!row) return null;

    return {
      tmdb_id: row.tmdb_id,
      media_type: (row.media_type === "tv" ? "tv" : "movie") as "movie" | "tv",
      recent_activity_count: 0,
    };
  }

  // Aggregate in JS (Supabase JS client doesn't expose SQL GROUP BY).
  const counts = new Map<string, TrendingTitle>();
  for (const row of data as Array<{ tmdb_id: number; media_type: string | null }>) {
    const media_type: "movie" | "tv" = row.media_type === "tv" ? "tv" : "movie";
    const key = `${media_type}:${row.tmdb_id}`;
    const existing = counts.get(key);
    if (existing) {
      existing.recent_activity_count += 1;
    } else {
      counts.set(key, {
        tmdb_id: row.tmdb_id,
        media_type,
        recent_activity_count: 1,
      });
    }
  }

  const sorted = Array.from(counts.values()).sort(
    (a, b) => b.recent_activity_count - a.recent_activity_count
  );

  return sorted[0] ?? null;
}

/** Fetches full TMDB detail for a title. Returns null on fetch failure. */
export async function fetchTmdbDetails(
  tmdb_id: number,
  media_type: "movie" | "tv",
  lang: Lang
): Promise<TmdbTitle | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/${media_type}/${tmdb_id}?api_key=${TMDB_KEY}&language=${tmdbLangCode(lang)}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;

    const json = await res.json();
    return {
      id: json.id,
      title: json.title || json.name || "Untitled",
      overview: json.overview || "",
      poster_path: json.poster_path,
      backdrop_path: json.backdrop_path,
      release_date: json.release_date,
      first_air_date: json.first_air_date,
      genres: json.genres,
      media_type,
      vote_average: json.vote_average,
    };
  } catch {
    return null;
  }
}

/** Fetches up to `limit` TMDB-recommended titles. Excludes the source title. */
export async function fetchTmdbRecommendations(
  tmdb_id: number,
  media_type: "movie" | "tv",
  lang: Lang,
  limit = 8
): Promise<TmdbTitle[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/${media_type}/${tmdb_id}/recommendations?api_key=${TMDB_KEY}&language=${tmdbLangCode(lang)}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];

    const json = await res.json();
    const rows = Array.isArray(json.results) ? json.results : [];

    return rows
      .filter((r: { id: number }) => r.id && r.id !== tmdb_id)
      .slice(0, limit)
      .map((r: {
        id: number;
        title?: string;
        name?: string;
        overview?: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
        release_date?: string | null;
        first_air_date?: string | null;
        vote_average?: number | null;
      }): TmdbTitle => ({
        id: r.id,
        title: r.title || r.name || "Untitled",
        overview: r.overview || "",
        poster_path: r.poster_path || null,
        backdrop_path: r.backdrop_path || null,
        release_date: r.release_date || null,
        first_air_date: r.first_air_date || null,
        media_type,
        vote_average: r.vote_average ?? null,
      }));
  } catch {
    return [];
  }
}

// ============================================================
// ARTICLE TEMPLATES — "What to watch after X"
// ============================================================

type TemplateStrings = {
  slugPrefix: string;           // e.g. "que-ver-despues-de"
  titlePrefix: string;          // e.g. "Qué ver después de"
  introHeading: string;         // e.g. "Si te gustó X, estas recomendaciones son para ti"
  introParagraph: (source: TmdbTitle) => string;
  recsHeading: string;          // e.g. "Nuestras recomendaciones"
  recOverviewFallback: string;  // e.g. "Todavía no tenemos una sinopsis para este título."
  ctaHeading: string;
  ctaParagraph: string;
  yearLabel: string;            // e.g. "Año"
  mediaTypeMovie: string;
  mediaTypeTv: string;
  summaryTemplate: (source: TmdbTitle, recsCount: number) => string;
};

const TEMPLATES: Record<Lang, TemplateStrings> = {
  es: {
    slugPrefix: "que-ver-despues-de",
    titlePrefix: "Qué ver después de",
    introHeading: "Si te gustó, acá tenés más para ver",
    introParagraph: (t) =>
      `Si acabás de terminar <strong>${escapeHtml(t.title)}</strong>${titleYear(t) ? ` (${titleYear(t)})` : ""} y te quedaste con ganas de más, te armamos una lista con ${t.media_type === "tv" ? "series" : "películas"} similares que están sonando en la comunidad de Peekr. Todas están disponibles para calificar, comentar y agregar a tus Peeklists.`,
    recsHeading: "Nuestras recomendaciones",
    recOverviewFallback:
      "Todavía no tenemos una sinopsis para este título. Abrí la ficha en Peekr para ver más detalles.",
    ctaHeading: "Sumate a la conversación",
    ctaParagraph:
      "Cada título en Peekr tiene su propia comunidad: gente calificando, comentando y armando listas en tiempo real. Descargá la app o seguí explorando desde la web para ver qué está viendo la comunidad hoy.",
    yearLabel: "Año",
    mediaTypeMovie: "Película",
    mediaTypeTv: "Serie",
    summaryTemplate: (t, n) =>
      `Terminaste ${t.title} y querés algo parecido. Te dejamos ${n} ${t.media_type === "tv" ? "series" : "películas"} recomendadas por la comunidad de Peekr para ver a continuación.`,
  },
  en: {
    slugPrefix: "what-to-watch-after",
    titlePrefix: "What to watch after",
    introHeading: "Liked it? Here's what to watch next",
    introParagraph: (t) =>
      `If you just finished <strong>${escapeHtml(t.title)}</strong>${titleYear(t) ? ` (${titleYear(t)})` : ""} and want more like it, we put together a list of similar ${t.media_type === "tv" ? "shows" : "movies"} trending in the Peekr community. Every title is open to rate, review, and add to your Peeklists.`,
    recsHeading: "Our recommendations",
    recOverviewFallback:
      "We don't have a synopsis for this title yet. Open it on Peekr to see more details.",
    ctaHeading: "Join the conversation",
    ctaParagraph:
      "Every title on Peekr has its own live community — people rating, commenting, and curating lists in real time. Download the app or keep exploring on the web to see what the community is watching today.",
    yearLabel: "Year",
    mediaTypeMovie: "Movie",
    mediaTypeTv: "Series",
    summaryTemplate: (t, n) =>
      `You finished ${t.title} and want something similar. Here are ${n} ${t.media_type === "tv" ? "shows" : "movies"} the Peekr community recommends watching next.`,
  },
  pt: {
    slugPrefix: "o-que-assistir-depois-de",
    titlePrefix: "O que assistir depois de",
    introHeading: "Gostou? Veja o que assistir a seguir",
    introParagraph: (t) =>
      `Se você acabou de terminar <strong>${escapeHtml(t.title)}</strong>${titleYear(t) ? ` (${titleYear(t)})` : ""} e quer mais do mesmo, separamos ${t.media_type === "tv" ? "séries" : "filmes"} parecidos que estão bombando na comunidade do Peekr. Todos os títulos estão abertos para avaliar, comentar e adicionar às suas Peeklists.`,
    recsHeading: "Nossas recomendações",
    recOverviewFallback:
      "Ainda não temos uma sinopse deste título. Abra a ficha no Peekr para ver mais detalhes.",
    ctaHeading: "Entre na conversa",
    ctaParagraph:
      "Cada título no Peekr tem sua própria comunidade ao vivo — gente avaliando, comentando e montando listas em tempo real. Baixe o app ou continue explorando pela web para ver o que a comunidade está assistindo hoje.",
    yearLabel: "Ano",
    mediaTypeMovie: "Filme",
    mediaTypeTv: "Série",
    summaryTemplate: (t, n) =>
      `Você terminou ${t.title} e quer algo parecido. Separamos ${n} ${t.media_type === "tv" ? "séries" : "filmes"} que a comunidade do Peekr recomenda assistir a seguir.`,
  },
};

/**
 * Renders a "what to watch after X" article in the given language.
 *
 * - Slug is deterministic per (source title, month) so re-running the
 *   same day/month for the same trending title will upsert instead of
 *   duplicate.
 * - body_html targets 600–800 words with H2/H3 structure and internal
 *   links to each recommended title.
 */
export function renderWhatToWatchAfter(
  source: TmdbTitle,
  recs: TmdbTitle[],
  lang: Lang
): GeneratedArticle {
  const t = TEMPLATES[lang];
  const sourceSlug = slugify(source.title);
  const stamp = yearMonth();
  const slug = `${t.slugPrefix}-${sourceSlug}-${stamp}`;
  // topic_key links the 3 language siblings — intentionally ignores slug
  // (which is lang-specific) and uses the stable TMDB id + month so any
  // lang can find its peers.
  const topic_key = `whattowatch-${source.id}-${stamp}`;

  const sourceYear = titleYear(source);
  const headline = `${t.titlePrefix} ${source.title}${sourceYear ? ` (${sourceYear})` : ""}`;

  const summary = t.summaryTemplate(source, recs.length);

  const recBlocks = recs
    .map((r) => {
      const year = titleYear(r);
      const mediaLabel =
        r.media_type === "tv" ? t.mediaTypeTv : t.mediaTypeMovie;
      const overview = r.overview.trim() || t.recOverviewFallback;

      return [
        `<h3><a href="${internalTitleUrl(r, lang)}">${escapeHtml(r.title)}</a>${year ? ` <span>(${escapeHtml(year)})</span>` : ""}</h3>`,
        `<p><strong>${escapeHtml(mediaLabel)}${year ? ` · ${escapeHtml(t.yearLabel)} ${escapeHtml(year)}` : ""}</strong></p>`,
        `<p>${escapeHtml(overview)}</p>`,
      ].join("\n");
    })
    .join("\n\n");

  const body_html = [
    `<h2>${escapeHtml(t.introHeading)}</h2>`,
    `<p>${t.introParagraph(source)}</p>`,
    `<h2>${escapeHtml(t.recsHeading)}</h2>`,
    recBlocks,
    `<h2>${escapeHtml(t.ctaHeading)}</h2>`,
    `<p>${escapeHtml(t.ctaParagraph)}</p>`,
  ].join("\n\n");

  const image_url = source.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${source.backdrop_path}`
    : source.poster_path
      ? `https://image.tmdb.org/t/p/w780${source.poster_path}`
      : null;

  return {
    slug,
    title: headline,
    summary,
    body_html,
    image_url,
    category: "recommendations",
    source_name: "Peekr",
    language: lang,
    topic_key,
  };
}
