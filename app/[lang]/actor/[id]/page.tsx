export const revalidate = 604800; //7 dias

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
const TMDB = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY!;
const SITE = "https://www.peekr.app";
const PROFILE = "https://image.tmdb.org/t/p/w500";
const POSTER = "https://image.tmdb.org/t/p/w342";
const BACKDROP = "https://image.tmdb.org/t/p/w1280";

type Lang = "en" | "es" | "pt";

type PageProps = {
  params: Promise<{
    lang: string;
    id: string;
  }>;
};

type PersonCredit = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  media_type?: "movie" | "tv";
  character?: string | null;
  job?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  popularity?: number;
  genre_ids?: number[];
};

type PersonResponse = {
  id: number;
  name: string;
  biography?: string | null;
  profile_path?: string | null;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  known_for_department?: string | null;
  popularity?: number | null;
  also_known_as?: string[];
  combined_credits?: {
    cast?: PersonCredit[];
    crew?: PersonCredit[];
  };
  images?: {
    profiles?: {
      file_path: string;
    }[];
  };
};

type GenreListResponse = {
  genres?: {
    id: number;
    name: string;
  }[];
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "es").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("pt")) return "pt";
  return "es";
}

function tmdbLanguage(lang: Lang) {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseIdSlug(idValue: string) {
  const match = idValue.match(/^(\d+)/);
  if (!match) return null;
  return Number(match[1]);
}

function titleHref(item: PersonCredit, lang: Lang) {
  const type = item.media_type === "tv" ? "tv" : "movie";
  const title = item.title || item.name || "title";
  return `/${lang}/title/${type}/${item.id}-${slugify(title)}`;
}

function getYear(item: PersonCredit) {
  const raw = item.release_date || item.first_air_date || "";
  return raw ? raw.slice(0, 4) : "";
}

function dedupeCredits(items: PersonCredit[]) {
  const seen = new Set<string>();
  const out: PersonCredit[] = [];

  for (const item of items) {
    const type = item.media_type || "movie";
    const key = `${type}-${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function buildGenreMap(genres?: { id: number; name: string }[]) {
  return new Map((genres ?? []).map((g) => [g.id, g.name.toLowerCase()]));
}

function isTalkLikeTVCredit(
  credit: PersonCredit,
  tvGenreMap: Map<number, string>
) {
  if (credit.media_type !== "tv") return false;

  const names = (credit.genre_ids ?? [])
    .map((id) => tvGenreMap.get(id) ?? "")
    .filter(Boolean);

  return names.some((name) =>
    ["talk", "news", "reality", "soap"].includes(name)
  );
}

function isRealSeriesCredit(
  credit: PersonCredit,
  tvGenreMap: Map<number, string>
) {
  if (credit.media_type !== "tv") return false;
  return !isTalkLikeTVCredit(credit, tvGenreMap);
}

function sortCredits(items: PersonCredit[]) {
  return [...items].sort((a, b) => {
    const aDate = a.release_date || a.first_air_date || "";
    const bDate = b.release_date || b.first_air_date || "";
    return bDate.localeCompare(aDate);
  });
}

function pickKnownFor(
  cast: PersonCredit[],
  crew: PersonCredit[],
  tvGenreMap: Map<number, string>
) {
  const merged = dedupeCredits([...cast, ...crew]).filter((credit) => {
    if (credit.media_type === "movie") return true;
    if (credit.media_type === "tv")
      return isRealSeriesCredit(credit, tvGenreMap);
    return false;
  });

  return [...merged]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 12);
}

function pickMovies(cast: PersonCredit[], crew: PersonCredit[]) {
  return sortCredits(
    dedupeCredits([...cast, ...crew]).filter((c) => c.media_type === "movie")
  ).slice(0, 18);
}

function pickTV(
  cast: PersonCredit[],
  crew: PersonCredit[],
  tvGenreMap: Map<number, string>
) {
  return sortCredits(
    dedupeCredits([...cast, ...crew]).filter((c) =>
      isRealSeriesCredit(c, tvGenreMap)
    )
  ).slice(0, 18);
}

function pickAppearances(
  cast: PersonCredit[],
  crew: PersonCredit[],
  tvGenreMap: Map<number, string>
) {
  return sortCredits(
    dedupeCredits([...cast, ...crew]).filter((c) =>
      isTalkLikeTVCredit(c, tvGenreMap)
    )
  ).slice(0, 18);
}

const getActor = cache(async function getActorCached(id: number, lang: Lang) {
  const res = await fetch(
    `${TMDB}/person/${id}?api_key=${TMDB_KEY}&language=${tmdbLanguage(
      lang
    )}&append_to_response=combined_credits,images`,
    { next: { revalidate: 604800 } }
  );

  if (!res.ok) return null;
  return (await res.json()) as PersonResponse;
});

const getTVGenres = cache(async function getTVGenresCached() {
  const res = await fetch(
    `${TMDB}/genre/tv/list?api_key=${TMDB_KEY}&language=en-US`,
    { next: { revalidate: 604800 } }
  );

  if (!res.ok) return new Map<number, string>();

  const json = (await res.json()) as GenreListResponse;
  return buildGenreMap(json.genres);
});

function getStrings(lang: Lang) {
  return {
    en: {
      actorNotFound: "Person not found",
      knownFor: "Known for",
      biography: "Biography",
      movies: "Movies",
      tv: "TV",
      born: "Born",
      died: "Died",
      placeOfBirth: "Place of birth",
      knownForDepartment: "Known for",
      aka: "Also known as",
      noBiography: "No biography available.",
      appearances: "Talk shows & appearances",
      defaultDescription:
        "Explore biography, movies, TV series and credits on Peekr.",
      onPeekrHeading: "On Peekr",
      peekrSummary: (name: string, dept: string, creditsCount: number) =>
        `${name}${dept ? ` is best known for work in ${dept}.` : "."} The Peekr community tracks ${creditsCount} credits from ${name}, including movies and TV series you can rate, discuss, and add to your own Peeklists.`,
      mostPopularHeading: "Popular titles from",
      noCreditsYet:
        "This person's filmography is not yet available on Peekr.",
    },
    es: {
      actorNotFound: "Persona no encontrada",
      knownFor: "Conocido por",
      biography: "Biografía",
      movies: "Películas",
      tv: "Series",
      born: "Nacimiento",
      died: "Fallecimiento",
      placeOfBirth: "Lugar de nacimiento",
      knownForDepartment: "Conocido por",
      aka: "También conocido como",
      noBiography: "No hay biografía disponible.",
      appearances: "Talk shows y apariciones",
      defaultDescription:
        "Explora biografía, películas, series y créditos en Peekr.",
      onPeekrHeading: "En Peekr",
      peekrSummary: (name: string, dept: string, creditsCount: number) =>
        `${name}${dept ? ` es reconocido/a principalmente por su trabajo como ${dept}.` : "."} En Peekr se registran ${creditsCount} créditos de ${name}, incluyendo películas y series que podés calificar, comentar y agregar a tus propias Peeklists.`,
      mostPopularHeading: "Títulos destacados de",
      noCreditsYet:
        "La filmografía de esta persona todavía no está disponible en Peekr.",
    },
    pt: {
      actorNotFound: "Pessoa não encontrada",
      knownFor: "Conhecido por",
      biography: "Biografia",
      movies: "Filmes",
      tv: "Séries",
      born: "Nascimento",
      died: "Falecimento",
      placeOfBirth: "Local de nascimento",
      knownForDepartment: "Conhecido por",
      aka: "Também conhecido como",
      noBiography: "Sem biografia disponível.",
      appearances: "Talk shows e aparições",
      defaultDescription:
        "Explore biografia, filmes, séries e créditos no Peekr.",
      onPeekrHeading: "No Peekr",
      peekrSummary: (name: string, dept: string, creditsCount: number) =>
        `${name}${dept ? ` é reconhecido/a principalmente pelo trabalho em ${dept}.` : "."} No Peekr estão registrados ${creditsCount} créditos de ${name}, incluindo filmes e séries que você pode avaliar, comentar e adicionar às suas próprias Peeklists.`,
      mostPopularHeading: "Títulos em destaque de",
      noCreditsYet:
        "A filmografia desta pessoa ainda não está disponível no Peekr.",
    },
  }[lang];
}

export async function generateMetadata({ params }: PageProps) {
  const { lang: rawLang, id } = await params;
  const lang = normalizeLang(rawLang);
  const numericId = parseIdSlug(id);
  const t = getStrings(lang);

  if (!numericId) {
    return {
      title: "Peekr",
      description: t.defaultDescription,
    };
  }

  const actor = await getActor(numericId, lang);

  if (!actor) {
    return {
      title: "Peekr",
      description: t.defaultDescription,
    };
  }

  const slug = slugify(actor.name);
  const canonicalPath = `/${lang}/actor/${numericId}-${slug}`;

  const fallbackDescription =
    lang === "es"
      ? `${actor.name} en Peekr. ${t.defaultDescription}`
      : lang === "pt"
        ? `${actor.name} no Peekr. ${t.defaultDescription}`
        : `${actor.name} on Peekr. ${t.defaultDescription}`;

  const description = actor.biography?.slice(0, 155) || fallbackDescription;

  return {
    title: `${actor.name} | Peekr`,
    description,
    alternates: {
      canonical: `${SITE}${canonicalPath}`,
      languages: {
        es: `${SITE}/es/actor/${numericId}-${slug}`,
        en: `${SITE}/en/actor/${numericId}-${slug}`,
        pt: `${SITE}/pt/actor/${numericId}-${slug}`,
        "x-default": `${SITE}/es/actor/${numericId}-${slug}`,
      },
    },
    openGraph: {
      title: `${actor.name} | Peekr`,
      description,
      url: `${SITE}${canonicalPath}`,
      siteName: "Peekr",
      type: "profile",
      images: actor.profile_path
        ? [
            {
              url: `${PROFILE}${actor.profile_path}`,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${actor.name} | Peekr`,
      description,
      images: actor.profile_path ? [`${PROFILE}${actor.profile_path}`] : [],
    },
  };
}

export default async function ActorPage({ params }: PageProps) {
  const { lang: rawLang, id } = await params;
  const lang = normalizeLang(rawLang);
  const numericId = parseIdSlug(id);

  if (!numericId) notFound();

  const t = getStrings(lang);

  const [actor, tvGenreMap] = await Promise.all([
    getActor(numericId, lang),
    getTVGenres(),
  ]);

  if (!actor) {
    notFound();
  }

  const cast = actor.combined_credits?.cast || [];
  const crew = actor.combined_credits?.crew || [];

  const knownFor = pickKnownFor(cast, crew, tvGenreMap);
  const movies = pickMovies(cast, crew);
  const tv = pickTV(cast, crew, tvGenreMap);
  const appearances = pickAppearances(cast, crew, tvGenreMap);

  const heroImage =
    actor.images?.profiles?.[0]?.file_path || actor.profile_path || null;

  const slug = slugify(actor.name);
  const canonicalPath = `/${lang}/actor/${numericId}-${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: actor.name,
    url: `${SITE}${canonicalPath}`,
    image: actor.profile_path
      ? `https://image.tmdb.org/t/p/w500${actor.profile_path}`
      : undefined,
    description: actor.biography?.slice(0, 300) || undefined,
    birthDate: actor.birthday || undefined,
    deathDate: actor.deathday || undefined,
    birthPlace: actor.place_of_birth || undefined,
    jobTitle: actor.known_for_department || undefined,
    alternateName: actor.also_known_as?.length
      ? actor.also_known_as
      : undefined,
    knowsAbout: knownFor.slice(0, 5).map((item) => ({
      "@type": item.media_type === "tv" ? "TVSeries" : "Movie",
      name: item.title || item.name,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Peekr",
        item: `${SITE}/${lang}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t.knownFor,
        item: `${SITE}/${lang}/explore`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: actor.name,
        item: `${SITE}${canonicalPath}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <style>{`
        .actor-page {
          min-height: 100vh;
          color: white;
        }

        .actor-hero {
          position: relative;
          height: 210px;
          overflow: hidden;
          border-radius: 0 0 24px 24px;
          background: #111318;
        }

        .actor-hero-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(11,11,15,0.18) 0%, rgba(11,11,15,0.84) 74%, rgba(11,11,15,1) 100%);
        }

        .actor-shell {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 20px 44px 20px;
        }

        .actor-header {
          position: relative;
          margin-top: -72px;
          display: grid;
          grid-template-columns: 132px 1fr;
          gap: 18px;
          align-items: start;
        }

        .actor-poster-wrap {
          width: 132px;
        }

        .actor-poster {
          width: 132px;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          border-radius: 18px;
          display: block;
          background: rgba(255,255,255,0.08);
          box-shadow: 0 18px 42px rgba(0,0,0,0.42);
        }

        .actor-main {
          padding-top: 6px;
        }

        .actor-main h1 {
          margin: 0;
          font-size: clamp(32px, 9vw, 58px);
          line-height: 0.96;
          letter-spacing: -0.04em;
          font-weight: 900;
        }

        .actor-subline {
          margin-top: 12px;
          color: rgba(255,255,255,0.78);
          font-size: 15px;
          line-height: 1.7;
        }

        .actor-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .meta-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 9px 13px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 13px;
          color: rgba(255,255,255,0.94);
        }

        .section-block {
          margin-top: 34px;
        }

        .section-title {
          margin: 0 0 14px 0;
          font-size: clamp(28px, 7vw, 38px);
          line-height: 1.02;
          letter-spacing: -0.03em;
          font-weight: 900;
        }

        .section-text {
          margin: 0;
          color: rgba(255,255,255,0.78);
          font-size: 16px;
          line-height: 1.8;
          max-width: 850px;
        }

        .aka-row {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 6px;
          -webkit-overflow-scrolling: touch;
        }

        .aka-pill {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          white-space: nowrap;
          font-size: 13px;
          color: rgba(255,255,255,0.9);
        }

        .credit-row {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }

        .credit-card {
          width: 144px;
          min-width: 144px;
          text-decoration: none;
          color: white;
          scroll-snap-align: start;
        }

        .credit-image,
        .credit-fallback {
          width: 144px;
          aspect-ratio: 2 / 3;
          border-radius: 18px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
          box-shadow: 0 14px 34px rgba(0,0,0,0.34);
        }

        .credit-meta {
          margin-top: 10px;
        }

        .credit-title {
          font-size: 13px;
          font-weight: 800;
          line-height: 1.35;
          color: rgba(255,255,255,0.96);
        }

        .credit-sub {
          margin-top: 4px;
          font-size: 12px;
          line-height: 1.4;
          color: rgba(255,255,255,0.6);
        }

        @media (min-width: 900px) {
          .actor-hero {
            height: 340px;
            border-radius: 0 0 28px 28px;
          }

          .actor-shell {
            padding: 0 28px 50px 28px;
          }

          .actor-header {
            margin-top: -120px;
            grid-template-columns: 220px 1fr;
            gap: 30px;
          }

          .actor-poster-wrap {
            width: 220px;
          }

          .actor-poster {
            width: 220px;
            border-radius: 20px;
          }

          .credit-card {
            width: 168px;
            min-width: 168px;
          }

          .credit-image,
          .credit-fallback {
            width: 168px;
          }
        }
      `}</style>

      <div className="actor-page">
        <div className="actor-hero">
          {heroImage ? (
            <Image
              src={`${BACKDROP}${heroImage}`}
              alt={actor.name}
              fill
              priority
              unoptimized
              sizes="100vw"
              style={{ objectFit: "cover", opacity: 0.3 }}
            />
          ) : null}
          <div className="actor-hero-overlay" />
        </div>

        <div className="actor-shell">
          <div className="actor-header">
            <div className="actor-poster-wrap">
              {actor.profile_path ? (
                <Image
                  src={`${PROFILE}${actor.profile_path}`}
                  alt={actor.name}
                  width={220}
                  height={293}
                  className="actor-poster"
                  unoptimized
                />
              ) : (
                <div className="actor-poster" />
              )}
            </div>

            <div className="actor-main">
              <h1>{actor.name}</h1>

              <div className="actor-meta">
                {actor.known_for_department ? (
                  <div className="meta-pill">
                    {t.knownForDepartment}: {actor.known_for_department}
                  </div>
                ) : null}

                {actor.birthday ? (
                  <div className="meta-pill">
                    {t.born}: {actor.birthday}
                  </div>
                ) : null}

                {actor.deathday ? (
                  <div className="meta-pill">
                    {t.died}: {actor.deathday}
                  </div>
                ) : null}
              </div>

              {actor.place_of_birth ? (
                <div className="actor-subline">
                  {t.placeOfBirth}: {actor.place_of_birth}
                </div>
              ) : null}
            </div>
          </div>

          {actor.biography || actor.also_known_as?.length ? (
            <section className="section-block">
              <h2 className="section-title">{t.biography}</h2>
              <p className="section-text">{actor.biography || t.noBiography}</p>
            </section>
          ) : null}

          {/* ============================================================
              UNIQUE CONTENT — Peekr-specific prose using our own data.
              Differentiates this page from generic TMDB-based sites so
              Google has a reason to index it beyond the TMDB biography.
              ============================================================ */}
          <section className="section-block">
            <h2 className="section-title">
              {t.onPeekrHeading}: {actor.name}
            </h2>
            <p className="section-text">
              {movies.length + tv.length > 0
                ? t.peekrSummary(
                    actor.name,
                    actor.known_for_department || "",
                    movies.length + tv.length
                  )
                : t.noCreditsYet}
            </p>
          </section>

          {actor.also_known_as && actor.also_known_as.length > 0 ? (
            <section className="section-block">
              <h2 className="section-title">{t.aka}</h2>
              <div className="aka-row">
                {actor.also_known_as.map((name) => (
                  <div key={name} className="aka-pill">
                    {name}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {knownFor.length > 0 ? (
            <section className="section-block">
              <h2 className="section-title">{t.knownFor}</h2>
              <div className="credit-row">
                {knownFor.map((item) => {
                  const title = item.title || item.name || "Untitled";
                  return (
                    <Link
                      key={`${item.media_type}-${item.id}`}
                      href={titleHref(item, lang)}
                      className="credit-card"
                    >
                      {item.poster_path ? (
                        <Image
                          src={`${POSTER}${item.poster_path}`}
                          alt={title}
                          width={168}
                          height={252}
                          className="credit-image"
                          unoptimized
                        />
                      ) : (
                        <div className="credit-fallback" />
                      )}

                      <div className="credit-meta">
                        <div className="credit-title">{title}</div>
                        <div className="credit-sub">
                          {getYear(item)}
                          {item.character
                            ? ` · ${item.character}`
                            : item.job
                              ? ` · ${item.job}`
                              : ""}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {movies.length > 0 ? (
            <section className="section-block">
              <h2 className="section-title">{t.movies}</h2>
              <div className="credit-row">
                {movies.map((item) => {
                  const title = item.title || item.name || "Untitled";
                  return (
                    <Link
                      key={`movie-${item.id}`}
                      href={titleHref(item, lang)}
                      className="credit-card"
                    >
                      {item.poster_path ? (
                        <Image
                          src={`${POSTER}${item.poster_path}`}
                          alt={title}
                          width={168}
                          height={252}
                          className="credit-image"
                          unoptimized
                        />
                      ) : (
                        <div className="credit-fallback" />
                      )}

                      <div className="credit-meta">
                        <div className="credit-title">{title}</div>
                        <div className="credit-sub">
                          {getYear(item)}
                          {item.character
                            ? ` · ${item.character}`
                            : item.job
                              ? ` · ${item.job}`
                              : ""}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {tv.length > 0 ? (
            <section className="section-block">
              <h2 className="section-title">{t.tv}</h2>
              <div className="credit-row">
                {tv.map((item) => {
                  const title = item.title || item.name || "Untitled";
                  return (
                    <Link
                      key={`tv-${item.id}`}
                      href={titleHref(item, lang)}
                      className="credit-card"
                    >
                      {item.poster_path ? (
                        <Image
                          src={`${POSTER}${item.poster_path}`}
                          alt={title}
                          width={168}
                          height={252}
                          className="credit-image"
                          unoptimized
                        />
                      ) : (
                        <div className="credit-fallback" />
                      )}

                      <div className="credit-meta">
                        <div className="credit-title">{title}</div>
                        <div className="credit-sub">
                          {getYear(item)}
                          {item.character
                            ? ` · ${item.character}`
                            : item.job
                              ? ` · ${item.job}`
                              : ""}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {appearances.length > 0 ? (
            <section className="section-block">
              <h2 className="section-title">{t.appearances}</h2>
              <div className="credit-row">
                {appearances.map((item) => {
                  const title = item.title || item.name || "Untitled";
                  return (
                    <Link
                      key={`appearance-${item.id}`}
                      href={titleHref(item, lang)}
                      className="credit-card"
                    >
                      {item.poster_path ? (
                        <Image
                          src={`${POSTER}${item.poster_path}`}
                          alt={title}
                          width={168}
                          height={252}
                          className="credit-image"
                          unoptimized
                        />
                      ) : (
                        <div className="credit-fallback" />
                      )}

                      <div className="credit-meta">
                        <div className="credit-title">{title}</div>
                        <div className="credit-sub">
                          {getYear(item)}
                          {item.character
                            ? ` · ${item.character}`
                            : item.job
                              ? ` · ${item.job}`
                              : ""}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
