/**
 * SATURDAY template — "Para ver el finde en [plataforma]" /
 * "Weekend picks on [platform]".
 *
 * Source: TMDB /discover/movie with with_watch_providers + region.
 * Rotates 6 major platforms by ISO week so a platform repeats every
 * ~6 weeks — and users in AR, US, BR get results filtered by their
 * own region's streaming availability.
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
  tmdbRegion,
  TmdbTitle,
} from "./shared";

type Platform = {
  id: number;
  display: string;  // display name (same across languages)
  slug: string;     // URL-safe slug
};

// TMDB provider IDs are stable globally; availability is scoped per region
// via watch_region below.
const PLATFORMS: Platform[] = [
  { id: 8, display: "Netflix", slug: "netflix" },
  { id: 9, display: "Prime Video", slug: "prime-video" },
  { id: 337, display: "Disney+", slug: "disney-plus" },
  { id: 1825, display: "Max", slug: "max" },
  { id: 531, display: "Paramount+", slug: "paramount-plus" },
  { id: 350, display: "Apple TV+", slug: "apple-tv-plus" },
];

function pickPlatformForWeek(date: Date): Platform {
  const w = isoWeek(date);
  return PLATFORMS[(w - 1) % PLATFORMS.length];
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

async function fetchPlatformPicks(
  platform: Platform,
  lang: Lang
): Promise<TmdbTitle[]> {
  const res = await tmdbFetch<DiscoverResponse>("/discover/movie", {
    language: tmdbLangCode(lang),
    with_watch_providers: platform.id,
    watch_region: tmdbRegion(lang),
    sort_by: "popularity.desc",
    "vote_count.gte": 200,
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
    headline: (platform: string) => string;
    intro: (platform: string) => string;
    summary: (platform: string, count: number) => string;
    recsHeading: (platform: string) => string;
    ctaHeading: string;
    cta: string;
    mediaTypeMovie: string;
    mediaTypeTv: string;
    yearLabel: string;
    overviewFallback: string;
  }
> = {
  es: {
    slugPrefix: "para-ver-el-finde-en",
    headline: (p) => `Para ver el finde en ${p}: películas recomendadas`,
    intro: (p) =>
      `Llegó el fin de semana y hay que elegir algo bueno. Te armamos una selección de películas que están disponibles en ${p} en tu región, ordenadas por popularidad actual. Abrí cualquier título en Peekr para ver reseñas de la comunidad.`,
    summary: (p, n) =>
      `${n} películas populares disponibles en ${p} para mirar este fin de semana, con links a las fichas en Peekr.`,
    recsHeading: (p) => `Qué mirar en ${p} este finde`,
    ctaHeading: "Guardalas en tu Peeklist",
    cta: "Creá una Peeklist de fin de semana en Peekr con los títulos que te llamaron la atención y compartila con amigos para decidir qué mirar.",
    mediaTypeMovie: "Película",
    mediaTypeTv: "Serie",
    yearLabel: "Año",
    overviewFallback:
      "Todavía no hay sinopsis disponible. Abrí la ficha en Peekr para más detalles.",
  },
  en: {
    slugPrefix: "weekend-watch-on",
    headline: (p) => `Weekend watch: top picks on ${p}`,
    intro: (p) =>
      `It's the weekend and you need something good. We pulled a list of movies currently streaming on ${p} in your region, sorted by popularity. Open any title on Peekr to see what the community has to say.`,
    summary: (p, n) =>
      `${n} popular movies streaming on ${p} this weekend, with direct links to their Peekr pages.`,
    recsHeading: (p) => `What to watch on ${p} this weekend`,
    ctaHeading: "Save them to a Peeklist",
    cta: "Build a weekend Peeklist with the titles that caught your eye and share it with friends to decide what to watch together.",
    mediaTypeMovie: "Movie",
    mediaTypeTv: "Series",
    yearLabel: "Year",
    overviewFallback:
      "No synopsis available yet. Open the page on Peekr for more details.",
  },
  pt: {
    slugPrefix: "para-o-fim-de-semana-em",
    headline: (p) => `Para o fim de semana em ${p}: filmes recomendados`,
    intro: (p) =>
      `Chegou o fim de semana e é hora de escolher algo bom. Montamos uma seleção de filmes disponíveis em ${p} na sua região, ordenados pela popularidade atual. Abra qualquer título no Peekr para ver avaliações da comunidade.`,
    summary: (p, n) =>
      `${n} filmes populares disponíveis em ${p} para assistir neste fim de semana, com links para as fichas no Peekr.`,
    recsHeading: (p) => `O que ver em ${p} neste fim de semana`,
    ctaHeading: "Salve na sua Peeklist",
    cta: "Crie uma Peeklist de fim de semana com os títulos que chamaram sua atenção e compartilhe com os amigos para decidir o que assistir juntos.",
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
  platform: Platform,
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

  const recBlocks = titles
    .map((t) => renderRecBlock(t, lang, recStrings))
    .join("\n\n");

  const body_html = composeArticleBody([
    `<h2>${escapeHtml(s.headline(platform.display))}</h2>`,
    `<p>${s.intro(platform.display)}</p>`,
    `<h2>${escapeHtml(s.recsHeading(platform.display))}</h2>`,
    recBlocks,
    `<h2>${escapeHtml(s.ctaHeading)}</h2>`,
    `<p>${escapeHtml(s.cta)}</p>`,
  ]);

  return {
    slug,
    title: s.headline(platform.display),
    summary: s.summary(platform.display, titles.length),
    body_html,
    image_url: titles[0] ? pickHeroImage(titles[0]) : null,
    category: "streaming",
    source_name: "Peekr",
    language: lang,
    topic_key,
  };
}

export async function generateWeekendPlatform(
  date: Date
): Promise<DailyArticleBatch> {
  const platform = pickPlatformForWeek(date);
  const week = isoYearWeek(date);
  const topic_key = `weekendplatform-${platform.id}-${week}`;

  const articles: GeneratedArticle[] = [];
  for (const lang of LANGS) {
    const titles = await fetchPlatformPicks(platform, lang);
    if (titles.length < 4) continue;

    const slug = slugify(
      `${STRINGS[lang].slugPrefix}-${platform.slug}-${week}`
    );
    articles.push(renderArticle(titles, lang, platform, topic_key, slug));
  }

  return {
    template: "weekend-platform",
    topic: `${platform.display} picks (week ${week})`,
    articles,
  };
}
