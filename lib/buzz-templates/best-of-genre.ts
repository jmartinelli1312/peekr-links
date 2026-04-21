/**
 * THURSDAY template — "Las mejores de [género]" / "Best of [genre]".
 *
 * Source: TMDB /discover/movie with genre filter + vote_count floor so we
 * don't surface obscure titles. Rotates through 10 genres by ISO week so
 * the same genre only repeats every ~10 weeks.
 */

import {
  composeArticleBody,
  DailyArticleBatch,
  escapeHtml,
  GeneratedArticle,
  isoWeek,
  isoYearWeek,
  Lang,
  LANGS,
  normalizeTmdbItem,
  pickHeroImage,
  renderRecBlock,
  slugify,
  tmdbFetch,
  tmdbLangCode,
  TmdbTitle,
  yearMonth,
} from "./shared";

type GenreEntry = {
  id: number;
  names: Record<Lang, string>;
  slugs: Record<Lang, string>;
};

// 10 genres rotating by ISO week. Picked for LATAM + English search
// volume; ordered so similar genres don't land on consecutive weeks.
const GENRES: GenreEntry[] = [
  {
    id: 18,
    names: { es: "drama", en: "drama", pt: "drama" },
    slugs: { es: "drama", en: "drama", pt: "drama" },
  },
  {
    id: 53,
    names: { es: "suspenso", en: "thriller", pt: "suspense" },
    slugs: { es: "suspenso", en: "thriller", pt: "suspense" },
  },
  {
    id: 35,
    names: { es: "comedia", en: "comedy", pt: "comédia" },
    slugs: { es: "comedia", en: "comedy", pt: "comedia" },
  },
  {
    id: 878,
    names: { es: "ciencia ficción", en: "sci-fi", pt: "ficção científica" },
    slugs: { es: "ciencia-ficcion", en: "sci-fi", pt: "ficcao-cientifica" },
  },
  {
    id: 27,
    names: { es: "terror", en: "horror", pt: "terror" },
    slugs: { es: "terror", en: "horror", pt: "terror" },
  },
  {
    id: 28,
    names: { es: "acción", en: "action", pt: "ação" },
    slugs: { es: "accion", en: "action", pt: "acao" },
  },
  {
    id: 16,
    names: { es: "animación", en: "animation", pt: "animação" },
    slugs: { es: "animacion", en: "animation", pt: "animacao" },
  },
  {
    id: 10749,
    names: { es: "romance", en: "romance", pt: "romance" },
    slugs: { es: "romance", en: "romance", pt: "romance" },
  },
  {
    id: 99,
    names: { es: "documental", en: "documentary", pt: "documentário" },
    slugs: { es: "documental", en: "documentary", pt: "documentario" },
  },
  {
    id: 80,
    names: { es: "crimen", en: "crime", pt: "crime" },
    slugs: { es: "crimen", en: "crime", pt: "crime" },
  },
];

function pickGenreForWeek(date: Date): GenreEntry {
  const w = isoWeek(date);
  return GENRES[(w - 1) % GENRES.length];
}

type DiscoverResponse = {
  results?: Array<{
    id: number;
    title?: string;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string | null;
    vote_average?: number | null;
  }>;
};

async function fetchBestOfGenre(
  genre: GenreEntry,
  lang: Lang
): Promise<TmdbTitle[]> {
  const res = await tmdbFetch<DiscoverResponse>("/discover/movie", {
    language: tmdbLangCode(lang),
    with_genres: genre.id,
    sort_by: "vote_average.desc",
    "vote_count.gte": 1500,
    page: 1,
  });

  return (res?.results ?? [])
    .filter((r) => r.id && (r.title || r.overview))
    .slice(0, 8)
    .map((r) => normalizeTmdbItem(r, "movie"));
}

const STRINGS: Record<
  Lang,
  {
    slugPrefix: string;
    headline: (genre: string) => string;
    intro: (genre: string) => string;
    summary: (genre: string, count: number) => string;
    recsHeading: (genre: string) => string;
    ctaHeading: string;
    cta: string;
    mediaTypeMovie: string;
    mediaTypeTv: string;
    yearLabel: string;
    overviewFallback: string;
  }
> = {
  es: {
    slugPrefix: "mejores-peliculas-de",
    headline: (g) => `Las mejores películas de ${g} según la comunidad`,
    intro: (g) =>
      `Si te gustan las películas de ${g}, esta selección es para vos. Filtramos las mejor calificadas con suficiente volumen de votos para que la lista no dependa de un ranking casual. Abrí cualquier título en Peekr para ver qué piensa la comunidad y sumar tu calificación.`,
    summary: (g, n) =>
      `Selección de ${n} películas imprescindibles de ${g} según reseñas del público, con links a las fichas en Peekr.`,
    recsHeading: (g) => `Lo mejor de ${g}`,
    ctaHeading: "Sumá tu opinión en Peekr",
    cta: "Cada ficha en Peekr tiene comentarios, calificaciones y listas. Si viste alguna de estas, dejá tu nota; si no, agregá a tu watchlist para no olvidarte.",
    mediaTypeMovie: "Película",
    mediaTypeTv: "Serie",
    yearLabel: "Año",
    overviewFallback:
      "Todavía no hay sinopsis disponible. Abrí la ficha en Peekr para más detalles.",
  },
  en: {
    slugPrefix: "best",
    headline: (g) => `The best ${g} movies according to audiences`,
    intro: (g) =>
      `If you love ${g} movies, this list is for you. We filtered for top-rated films with enough ratings to make the ranking real. Open any title on Peekr to see what the community is saying and add your own rating.`,
    summary: (g, n) =>
      `${n} must-watch ${g} films based on audience ratings, with direct links to their Peekr pages.`,
    recsHeading: (g) => `The best ${g} picks`,
    ctaHeading: "Add your take on Peekr",
    cta: "Every Peekr page has comments, ratings, and lists. Seen one of these? Drop your rating. Haven't? Add it to your watchlist.",
    mediaTypeMovie: "Movie",
    mediaTypeTv: "Series",
    yearLabel: "Year",
    overviewFallback:
      "No synopsis available yet. Open the page on Peekr for more details.",
  },
  pt: {
    slugPrefix: "melhores-filmes-de",
    headline: (g) => `Os melhores filmes de ${g} segundo o público`,
    intro: (g) =>
      `Se você curte filmes de ${g}, essa seleção é para você. Filtramos os melhor avaliados com volume de votos suficiente para o ranking ter peso. Abra qualquer título no Peekr para ver o que a comunidade está dizendo e adicionar sua avaliação.`,
    summary: (g, n) =>
      `${n} filmes imperdíveis de ${g} segundo as avaliações do público, com links diretos para as fichas no Peekr.`,
    recsHeading: (g) => `O melhor de ${g}`,
    ctaHeading: "Dê sua opinião no Peekr",
    cta: "Cada ficha no Peekr tem comentários, avaliações e listas. Já viu algum? Deixe sua nota; se ainda não, adicione à watchlist.",
    mediaTypeMovie: "Filme",
    mediaTypeTv: "Série",
    yearLabel: "Ano",
    overviewFallback:
      "Ainda não há sinopse disponível. Abra a ficha no Peekr para mais detalhes.",
  },
};

function renderArticle(
  titles: TmdbTitle[],
  lang: Lang,
  genre: GenreEntry,
  topic_key: string,
  slug: string
): GeneratedArticle {
  const s = STRINGS[lang];
  const genreName = genre.names[lang];

  const recStrings = {
    mediaTypeMovie: s.mediaTypeMovie,
    mediaTypeTv: s.mediaTypeTv,
    yearLabel: s.yearLabel,
    overviewFallback: s.overviewFallback,
  };

  const recBlocks = titles
    .map((t) => renderRecBlock(t, lang, recStrings))
    .join("\n\n");

  const body_html = composeArticleBody([
    `<h2>${escapeHtml(s.headline(genreName))}</h2>`,
    `<p>${s.intro(genreName)}</p>`,
    `<h2>${escapeHtml(s.recsHeading(genreName))}</h2>`,
    recBlocks,
    `<h2>${escapeHtml(s.ctaHeading)}</h2>`,
    `<p>${escapeHtml(s.cta)}</p>`,
  ]);

  return {
    slug,
    title: s.headline(genreName),
    summary: s.summary(genreName, titles.length),
    body_html,
    image_url: titles[0] ? pickHeroImage(titles[0]) : null,
    category: "movies",
    source_name: "Peekr",
    language: lang,
    topic_key,
  };
}

export async function generateBestOfGenre(
  date: Date
): Promise<DailyArticleBatch> {
  const genre = pickGenreForWeek(date);
  const stamp = yearMonth(date);
  const topic_key = `bestgenre-${genre.id}-${stamp}`;

  const articles: GeneratedArticle[] = [];
  for (const lang of LANGS) {
    const titles = await fetchBestOfGenre(genre, lang);
    if (titles.length < 4) continue;

    const slugStem = `${STRINGS[lang].slugPrefix}-${genre.slugs[lang]}-${stamp}`;
    articles.push(renderArticle(titles, lang, genre, topic_key, slugify(slugStem)));
  }

  return {
    template: "best-of-genre",
    topic: `Best of ${genre.names.en} (week ${isoYearWeek(date)})`,
    articles,
  };
}
