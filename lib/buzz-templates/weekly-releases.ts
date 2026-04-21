/**
 * TUESDAY template — "Estrenos de esta semana" / "This week's new releases".
 *
 * Source: TMDB /movie/now_playing + /tv/on_the_air.  Works with zero Peekr
 * activity since it's purely external data. Top 4 movies + top 4 TV shows
 * = 8 internal title-page links per article.
 */

import {
  composeArticleBody,
  DailyArticleBatch,
  escapeHtml,
  GeneratedArticle,
  isoYearWeek,
  Lang,
  LANGS,
  normalizeTmdbItem,
  pickHeroImage,
  renderRecBlock,
  slugify,
  tmdbFetch,
  tmdbLangCode,
  tmdbRegion,
  TmdbTitle,
} from "./shared";

type TmdbListResponse = {
  results?: Array<{
    id: number;
    title?: string;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string | null;
    first_air_date?: string | null;
    vote_average?: number | null;
  }>;
};

async function fetchWeeklyReleases(
  lang: Lang
): Promise<{ movies: TmdbTitle[]; shows: TmdbTitle[] }> {
  const [moviesRes, showsRes] = await Promise.all([
    tmdbFetch<TmdbListResponse>("/movie/now_playing", {
      language: tmdbLangCode(lang),
      region: tmdbRegion(lang),
      page: 1,
    }),
    tmdbFetch<TmdbListResponse>("/tv/on_the_air", {
      language: tmdbLangCode(lang),
      page: 1,
    }),
  ]);

  const movies = (moviesRes?.results ?? [])
    .filter((r) => r.id && (r.title || r.overview))
    .slice(0, 4)
    .map((r) => normalizeTmdbItem(r, "movie"));

  const shows = (showsRes?.results ?? [])
    .filter((r) => r.id && (r.name || r.overview))
    .slice(0, 4)
    .map((r) => normalizeTmdbItem(r, "tv"));

  return { movies, shows };
}

const STRINGS: Record<
  Lang,
  {
    slugStem: string;
    headline: string;
    intro: string;
    summary: string;
    moviesHeading: string;
    tvHeading: string;
    ctaHeading: string;
    cta: string;
    mediaTypeMovie: string;
    mediaTypeTv: string;
    yearLabel: string;
    overviewFallback: string;
  }
> = {
  es: {
    slugStem: "estrenos-de-la-semana",
    headline: "Estrenos de la semana: qué se lanza en cines y streaming",
    intro:
      "Cada semana hay películas nuevas en cartelera y series arrancando temporadas. Te armamos la lista de lo que está entrando ahora mismo para que no te pierdas ningún estreno. Todos los títulos tienen ficha abierta en Peekr para calificar y comentar.",
    summary:
      "Películas y series que se están estrenando esta semana según TMDB, con links directos a sus fichas en Peekr.",
    moviesHeading: "Películas que se estrenan esta semana",
    tvHeading: "Series que arrancan o vuelven esta semana",
    ctaHeading: "Seguí explorando en Peekr",
    cta: "Abrí cualquier título para ver qué piensa la comunidad, agregarlo a tu watchlist o marcarlo como visto.",
    mediaTypeMovie: "Película",
    mediaTypeTv: "Serie",
    yearLabel: "Año",
    overviewFallback:
      "Todavía no hay sinopsis disponible. Abrí la ficha en Peekr para más detalles.",
  },
  en: {
    slugStem: "this-week-new-releases",
    headline: "This week's new releases: movies and TV worth watching",
    intro:
      "There's new stuff in theaters and streaming every week. Here's what just dropped — in cinemas, on streaming, and returning with new seasons. Every title is open on Peekr to rate, review, and add to your watchlist.",
    summary:
      "Fresh movies and TV shows premiering this week, pulled from TMDB and linked to their Peekr pages.",
    moviesHeading: "New movies out this week",
    tvHeading: "New and returning shows this week",
    ctaHeading: "Keep exploring on Peekr",
    cta: "Open any title to see what the community is saying, add it to your watchlist, or mark it as watched.",
    mediaTypeMovie: "Movie",
    mediaTypeTv: "Series",
    yearLabel: "Year",
    overviewFallback:
      "No synopsis available yet. Open the page on Peekr for more details.",
  },
  pt: {
    slugStem: "estreias-da-semana",
    headline: "Estreias da semana: filmes e séries nos cinemas e streaming",
    intro:
      "Toda semana chegam filmes novos nos cinemas e séries novas nas plataformas. Reunimos as estreias da semana para você não perder nada. Todos os títulos têm ficha aberta no Peekr para avaliar e comentar.",
    summary:
      "Filmes e séries estreando esta semana segundo o TMDB, com links diretos para as fichas no Peekr.",
    moviesHeading: "Filmes estreando esta semana",
    tvHeading: "Séries estreando ou voltando esta semana",
    ctaHeading: "Continue explorando no Peekr",
    cta: "Abra qualquer título para ver o que a comunidade está dizendo, adicioná-lo à sua watchlist ou marcar como assistido.",
    mediaTypeMovie: "Filme",
    mediaTypeTv: "Série",
    yearLabel: "Ano",
    overviewFallback:
      "Ainda não há sinopse disponível. Abra a ficha no Peekr para mais detalhes.",
  },
};

function renderArticle(
  movies: TmdbTitle[],
  shows: TmdbTitle[],
  lang: Lang,
  topic_key: string,
  slug: string
): GeneratedArticle {
  const s = STRINGS[lang];

  const recStrings = {
    mediaTypeMovie: s.mediaTypeMovie,
    mediaTypeTv: s.mediaTypeTv,
    yearLabel: s.yearLabel,
    overviewFallback: s.overviewFallback,
  };

  const movieBlocks = movies
    .map((m) => renderRecBlock(m, lang, recStrings))
    .join("\n\n");

  const showBlocks = shows
    .map((sh) => renderRecBlock(sh, lang, recStrings))
    .join("\n\n");

  const body_html = composeArticleBody([
    `<h2>${escapeHtml(s.headline)}</h2>`,
    `<p>${s.intro}</p>`,
    movies.length ? `<h2>${escapeHtml(s.moviesHeading)}</h2>` : null,
    movies.length ? movieBlocks : null,
    shows.length ? `<h2>${escapeHtml(s.tvHeading)}</h2>` : null,
    shows.length ? showBlocks : null,
    `<h2>${escapeHtml(s.ctaHeading)}</h2>`,
    `<p>${escapeHtml(s.cta)}</p>`,
  ]);

  const heroSource = movies[0] || shows[0];
  const image_url = heroSource ? pickHeroImage(heroSource) : null;

  return {
    slug,
    title: s.headline,
    summary: s.summary,
    body_html,
    image_url,
    category: "streaming",
    source_name: "Peekr",
    language: lang,
    topic_key,
  };
}

export async function generateWeeklyReleases(
  date: Date
): Promise<DailyArticleBatch> {
  const week = isoYearWeek(date);
  const topic_key = `weeklyreleases-${week}`;

  const articles: GeneratedArticle[] = [];
  for (const lang of LANGS) {
    const { movies, shows } = await fetchWeeklyReleases(lang);
    if (movies.length + shows.length < 3) continue;

    const s = STRINGS[lang];
    const slug = `${s.slugStem}-${slugify(week)}`;
    articles.push(renderArticle(movies, shows, lang, topic_key, slug));
  }

  return {
    template: "weekly-releases",
    topic: `Releases week ${week}`,
    articles,
  };
}
