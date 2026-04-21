/**
 * SUNDAY template — "Maratón: todo de [director]" / "[Director] marathon".
 *
 * Source: TMDB /person/{id} + /person/{id}/movie_credits filtered to
 * Directed entries. Rotates a curated list of directors by ISO week
 * so the same director repeats every ~12 weeks.
 */

import {
  composeArticleBody,
  DailyArticleBatch,
  escapeHtml,
  GeneratedArticle,
  isoWeek,
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

type Director = {
  id: number;
  name: string;
  slug: string;
};

// Mixed international + LATAM. TMDB person IDs verified 2026-04-21.
// Ordered so similar-era directors don't land on consecutive weeks.
const DIRECTORS: Director[] = [
  { id: 525, name: "Christopher Nolan", slug: "christopher-nolan" },
  { id: 137427, name: "Denis Villeneuve", slug: "denis-villeneuve" },
  { id: 10828, name: "Guillermo del Toro", slug: "guillermo-del-toro" },
  { id: 11218, name: "Alfonso Cuarón", slug: "alfonso-cuaron" },
  { id: 309, name: "Pedro Almodóvar", slug: "pedro-almodovar" },
  { id: 1032, name: "Martin Scorsese", slug: "martin-scorsese" },
  { id: 138, name: "Quentin Tarantino", slug: "quentin-tarantino" },
  { id: 5655, name: "Wes Anderson", slug: "wes-anderson" },
  { id: 7467, name: "David Fincher", slug: "david-fincher" },
  { id: 488, name: "Steven Spielberg", slug: "steven-spielberg" },
  { id: 21684, name: "Bong Joon-ho", slug: "bong-joon-ho" },
  { id: 1769, name: "Sofia Coppola", slug: "sofia-coppola" },
  { id: 591600, name: "Damián Szifron", slug: "damian-szifron" },
];

function pickDirectorForWeek(date: Date): Director {
  const w = isoWeek(date);
  return DIRECTORS[(w - 1) % DIRECTORS.length];
}

type PersonResponse = {
  id: number;
  name?: string;
  biography?: string;
  profile_path?: string | null;
  known_for_department?: string | null;
  movie_credits?: {
    crew?: Array<{
      id: number;
      job?: string | null;
      department?: string | null;
      title?: string | null;
      overview?: string | null;
      poster_path?: string | null;
      backdrop_path?: string | null;
      release_date?: string | null;
      vote_average?: number | null;
      vote_count?: number | null;
    }>;
  };
};

async function fetchDirectorFilms(
  director: Director,
  lang: Lang
): Promise<{ films: TmdbTitle[]; person: PersonResponse | null }> {
  const res = await tmdbFetch<PersonResponse>(
    `/person/${director.id}`,
    {
      language: tmdbLangCode(lang),
      append_to_response: "movie_credits",
    }
  );

  const crew = res?.movie_credits?.crew ?? [];

  // Dedupe by id (a director can appear multiple times on one film) and
  // keep only Directed credits with enough audience traction.
  const seen = new Set<number>();
  const films = crew
    .filter(
      (c) =>
        c.id &&
        !seen.has(c.id) &&
        (c.job ?? "").toLowerCase() === "director" &&
        (c.vote_count ?? 0) >= 200
    )
    .map((c) => {
      seen.add(c.id);
      return normalizeTmdbItem(
        {
          id: c.id,
          title: c.title ?? undefined,
          overview: c.overview ?? undefined,
          poster_path: c.poster_path,
          backdrop_path: c.backdrop_path,
          release_date: c.release_date,
          vote_average: c.vote_average,
        },
        "movie"
      );
    })
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .slice(0, 8);

  return { films, person: res ?? null };
}

const STRINGS: Record<
  Lang,
  {
    slugPrefix: string;
    headline: (director: string) => string;
    intro: (director: string, biographyExcerpt: string) => string;
    summary: (director: string, count: number) => string;
    recsHeading: (director: string) => string;
    ctaHeading: string;
    cta: (director: string) => string;
    mediaTypeMovie: string;
    mediaTypeTv: string;
    yearLabel: string;
    overviewFallback: string;
    defaultBioLead: (director: string) => string;
  }
> = {
  es: {
    slugPrefix: "maraton-de",
    headline: (d) => `Maratón de ${d}: sus mejores películas en un plan de fin de semana`,
    intro: (d, bio) =>
      `Si quisieras entender por qué ${d} es uno de los nombres más citados cuando se habla de cine contemporáneo, lo mejor es ver su obra en bloque. ${bio} Armá la maratón con esta selección de sus películas mejor valoradas por el público.`,
    summary: (d, n) =>
      `Las ${n} películas imprescindibles de ${d} para armar una maratón, con links directos a las fichas en Peekr.`,
    recsHeading: (d) => `Las imperdibles de ${d}`,
    ctaHeading: "Creá tu maratón en Peekr",
    cta: (d) =>
      `En Peekr podés armar una Peeklist pública de "${d} imprescindible" y compartirla con amigos para ver juntos. Cada película tiene su propia comunidad con calificaciones y reseñas.`,
    mediaTypeMovie: "Película",
    mediaTypeTv: "Serie",
    yearLabel: "Año",
    overviewFallback:
      "Todavía no hay sinopsis disponible. Abrí la ficha en Peekr para más detalles.",
    defaultBioLead: (d) =>
      `${d} construyó una filmografía reconocible que mezcla autor y alcance masivo.`,
  },
  en: {
    slugPrefix: "director-marathon",
    headline: (d) => `${d} marathon: the essential films for a weekend binge`,
    intro: (d, bio) =>
      `If you want to understand why ${d} is one of the most cited names in contemporary cinema, the best approach is to watch the work back-to-back. ${bio} Build the marathon with this selection of their best-rated films.`,
    summary: (d, n) =>
      `The ${n} essential ${d} films to binge in a single weekend, with direct links to their Peekr pages.`,
    recsHeading: (d) => `${d}'s must-watch films`,
    ctaHeading: "Build your marathon on Peekr",
    cta: (d) =>
      `On Peekr you can build a public Peeklist called "Essential ${d}" and share it with friends for a group watch. Every film has its own community with ratings and reviews.`,
    mediaTypeMovie: "Movie",
    mediaTypeTv: "Series",
    yearLabel: "Year",
    overviewFallback:
      "No synopsis available yet. Open the page on Peekr for more details.",
    defaultBioLead: (d) =>
      `${d} built a recognizable body of work blending auteur sensibilities with mass appeal.`,
  },
  pt: {
    slugPrefix: "maratona-de",
    headline: (d) => `Maratona de ${d}: os filmes essenciais para o fim de semana`,
    intro: (d, bio) =>
      `Se você quer entender por que ${d} é um dos nomes mais citados quando se fala em cinema contemporâneo, vale ver a obra em sequência. ${bio} Monte a maratona com esta seleção dos filmes mais bem avaliados pelo público.`,
    summary: (d, n) =>
      `Os ${n} filmes essenciais de ${d} para uma maratona de fim de semana, com links diretos para as fichas no Peekr.`,
    recsHeading: (d) => `Os imperdíveis de ${d}`,
    ctaHeading: "Monte sua maratona no Peekr",
    cta: (d) =>
      `No Peekr você pode criar uma Peeklist pública "Essencial ${d}" e compartilhar com os amigos para assistir junto. Cada filme tem sua comunidade com avaliações e resenhas.`,
    mediaTypeMovie: "Filme",
    mediaTypeTv: "Série",
    yearLabel: "Ano",
    overviewFallback:
      "Ainda não há sinopse disponível. Abra a ficha no Peekr para mais detalhes.",
    defaultBioLead: (d) =>
      `${d} construiu uma filmografia reconhecível que mistura sensibilidade autoral com alcance de massa.`,
  },
};

function extractBioSentence(bio: string | null | undefined): string {
  if (!bio) return "";
  // First 2 sentences, capped at 280 chars — keeps the intro readable
  // without dumping TMDB's full biography.
  const firstTwo = bio.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").trim();
  return firstTwo.length > 280 ? firstTwo.slice(0, 280) + "…" : firstTwo;
}

function renderArticle(
  films: TmdbTitle[],
  person: PersonResponse | null,
  lang: Lang,
  director: Director,
  topic_key: string,
  slug: string
): GeneratedArticle {
  const s = STRINGS[lang];
  const displayName = person?.name || director.name;

  const bioLead =
    extractBioSentence(person?.biography) || s.defaultBioLead(displayName);

  const recStrings = {
    mediaTypeMovie: s.mediaTypeMovie,
    mediaTypeTv: s.mediaTypeTv,
    yearLabel: s.yearLabel,
    overviewFallback: s.overviewFallback,
  };

  const recBlocks = films
    .map((t) => renderRecBlock(t, lang, recStrings))
    .join("\n\n");

  const body_html = composeArticleBody([
    `<h2>${escapeHtml(s.headline(displayName))}</h2>`,
    `<p>${s.intro(escapeHtml(displayName), escapeHtml(bioLead))}</p>`,
    `<h2>${escapeHtml(s.recsHeading(displayName))}</h2>`,
    recBlocks,
    `<h2>${escapeHtml(s.ctaHeading)}</h2>`,
    `<p>${escapeHtml(s.cta(displayName))}</p>`,
  ]);

  return {
    slug,
    title: s.headline(displayName),
    summary: s.summary(displayName, films.length),
    body_html,
    image_url: films[0] ? pickHeroImage(films[0]) : null,
    category: "reviews",
    source_name: "Peekr",
    language: lang,
    topic_key,
  };
}

export async function generateDirectorMarathon(
  date: Date
): Promise<DailyArticleBatch> {
  const director = pickDirectorForWeek(date);
  const stamp = yearMonth(date);
  const topic_key = `directormarathon-${director.id}-${stamp}`;

  const articles: GeneratedArticle[] = [];
  for (const lang of LANGS) {
    const { films, person } = await fetchDirectorFilms(director, lang);
    if (films.length < 4) continue;

    const slug = slugify(
      `${STRINGS[lang].slugPrefix}-${director.slug}-${stamp}`
    );
    articles.push(
      renderArticle(films, person, lang, director, topic_key, slug)
    );
  }

  return {
    template: "director-marathon",
    topic: `${director.name} (${stamp})`,
    articles,
  };
}
