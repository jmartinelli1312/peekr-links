/**
 * FRIDAY template — "Lo que está en tendencia esta semana" /
 * "What's trending this week worldwide".
 *
 * Source: TMDB /trending/all/week — global signal, always fresh.
 * One weekly snapshot per ISO week so the topic_key locks
 * Monday-to-Sunday.
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
  TmdbTitle,
} from "./shared";

type TrendingResponse = {
  results?: Array<{
    id: number;
    media_type?: string;
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

async function fetchWeeklyTrending(lang: Lang): Promise<TmdbTitle[]> {
  const res = await tmdbFetch<TrendingResponse>("/trending/all/week", {
    language: tmdbLangCode(lang),
  });

  return (res?.results ?? [])
    .filter(
      (r) =>
        r.id &&
        (r.title || r.name) &&
        (r.media_type === "movie" || r.media_type === "tv")
    )
    .slice(0, 10)
    .map((r) =>
      normalizeTmdbItem(r, r.media_type === "tv" ? "tv" : "movie")
    );
}

const STRINGS: Record<
  Lang,
  {
    slugStem: string;
    headline: string;
    intro: string;
    summary: (count: number) => string;
    recsHeading: string;
    ctaHeading: string;
    cta: string;
    mediaTypeMovie: string;
    mediaTypeTv: string;
    yearLabel: string;
    overviewFallback: string;
  }
> = {
  es: {
    slugStem: "lo-mas-visto-en-el-mundo-esta-semana",
    headline: "Lo más visto en el mundo esta semana",
    intro:
      "La comunidad global de cine y series no para. Esta semana estos títulos están rompiendo: son las películas y series con más actividad en tendencia mundial según los datos más frescos. Abrilos en Peekr para ver qué está diciendo la comunidad local.",
    summary: (n) =>
      `${n} películas y series que están siendo tendencia en el mundo esta semana, con links directos a sus fichas en Peekr.`,
    recsHeading: "El top mundial de la semana",
    ctaHeading: "Comparalo con lo que se ve en Peekr",
    cta: "En Peekr podés ver qué de esto está sonando puntualmente en tu comunidad: calificaciones, comentarios y listas creadas por los usuarios.",
    mediaTypeMovie: "Película",
    mediaTypeTv: "Serie",
    yearLabel: "Año",
    overviewFallback:
      "Todavía no hay sinopsis disponible. Abrí la ficha en Peekr para más detalles.",
  },
  en: {
    slugStem: "most-watched-worldwide-this-week",
    headline: "Most watched worldwide this week",
    intro:
      "The global movie and TV community never rests. These are the titles trending worldwide this week — the films and shows with the most traction right now. Open them on Peekr to see what your local community thinks.",
    summary: (n) =>
      `${n} films and TV shows trending worldwide this week, with direct links to their Peekr pages.`,
    recsHeading: "This week's global top",
    ctaHeading: "Compare with what's hot on Peekr",
    cta: "On Peekr you can see which of these are popping locally: ratings, comments, and user-curated lists.",
    mediaTypeMovie: "Movie",
    mediaTypeTv: "Series",
    yearLabel: "Year",
    overviewFallback:
      "No synopsis available yet. Open the page on Peekr for more details.",
  },
  pt: {
    slugStem: "mais-assistidos-no-mundo-esta-semana",
    headline: "Mais assistidos no mundo esta semana",
    intro:
      "A comunidade global de cinema e séries não para. Estes são os títulos em alta no mundo inteiro esta semana — os filmes e séries com mais tração agora. Abra no Peekr para ver o que sua comunidade local está dizendo.",
    summary: (n) =>
      `${n} filmes e séries em alta no mundo esta semana, com links diretos para as fichas no Peekr.`,
    recsHeading: "Top mundial da semana",
    ctaHeading: "Compare com o que está bombando no Peekr",
    cta: "No Peekr você vê quais destes estão em alta localmente: avaliações, comentários e listas criadas por usuários.",
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
    `<h2>${escapeHtml(s.headline)}</h2>`,
    `<p>${s.intro}</p>`,
    `<h2>${escapeHtml(s.recsHeading)}</h2>`,
    recBlocks,
    `<h2>${escapeHtml(s.ctaHeading)}</h2>`,
    `<p>${escapeHtml(s.cta)}</p>`,
  ]);

  return {
    slug,
    title: s.headline,
    summary: s.summary(titles.length),
    body_html,
    image_url: titles[0] ? pickHeroImage(titles[0]) : null,
    category: "trailers",
    source_name: "Peekr",
    language: lang,
    topic_key,
  };
}

export async function generateWeeklyTrending(
  date: Date
): Promise<DailyArticleBatch> {
  const week = isoYearWeek(date);
  const topic_key = `weeklytrending-${week}`;

  const articles: GeneratedArticle[] = [];
  for (const lang of LANGS) {
    const titles = await fetchWeeklyTrending(lang);
    if (titles.length < 5) continue;

    const slug = `${STRINGS[lang].slugStem}-${slugify(week)}`;
    articles.push(renderArticle(titles, lang, topic_key, slug));
  }

  return {
    template: "weekly-trending",
    topic: `Trending week ${week}`,
    articles,
  };
}
