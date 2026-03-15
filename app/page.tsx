export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w342";
const BRAND = "#FA0082";

/*
  REQUIRED SCREENSHOTS IN /public/home/

  /public/home/feed-en.png
  /public/home/profile-en.png
  /public/home/explore-es.png
  /public/home/profile-es.png
  /public/home/actor-es.png
  /public/home/feed-es.png
  /public/home/actor-pt.png
  /public/home/feed-pt.png

  If you want, later we can rename and standardize these.
*/

type Lang = "en" | "es" | "pt";

type TmdbTitle = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
};

type TmdbPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

function tmdbLanguage(lang: Lang) {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}

async function fetchTMDB<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getHomeData(lang: Lang) {
  const apiLang = tmdbLanguage(lang);

  const [topMovies, topTV, popularPeople] = await Promise.all([
    fetchTMDB<{ results: TmdbTitle[] }>(
      `${TMDB_BASE}/movie/top_rated?api_key=${TMDB_KEY}&language=${apiLang}`
    ),
    fetchTMDB<{ results: TmdbTitle[] }>(
      `${TMDB_BASE}/tv/top_rated?api_key=${TMDB_KEY}&language=${apiLang}`
    ),
    fetchTMDB<{ results: TmdbPerson[] }>(
      `${TMDB_BASE}/person/popular?api_key=${TMDB_KEY}&language=${apiLang}`
    ),
  ]);

  return {
    topMovies: topMovies?.results ?? [],
    topTV: topTV?.results ?? [],
    popularPeople: popularPeople?.results ?? [],
  };
}

function getYear(item: TmdbTitle) {
  const raw = item.release_date || item.first_air_date || "";
  return raw ? raw.slice(0, 4) : "";
}

function sectionTitle(title: string, subtitle?: string) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 34,
          lineHeight: 1.05,
          color: "white",
          fontWeight: 900,
          letterSpacing: "-0.03em",
        }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          style={{
            margin: "10px 0 0 0",
            color: "rgba(255,255,255,0.70)",
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: 820,
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function titleRow(items: TmdbTitle[], type: "movie" | "tv") {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        overflowX: "auto",
        paddingBottom: 8,
      }}
    >
      {items.slice(0, 12).map((item) => {
        const title = item.title || item.name || "Untitled";
        const poster = item.poster_path ? `${POSTER}${item.poster_path}` : null;

        return (
          <Link
            key={`${type}-${item.id}`}
            href={`/title/${type}/${item.id}`}
            style={{
              textDecoration: "none",
              color: "white",
              width: 165,
              minWidth: 165,
              flex: "0 0 165px",
            }}
          >
            {poster ? (
              <img
                src={poster}
                alt={title}
                style={{
                  width: 165,
                  height: 248,
                  objectFit: "cover",
                  borderRadius: 18,
                  display: "block",
                  boxShadow: "0 14px 36px rgba(0,0,0,0.35)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 165,
                  height: 248,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            )}

            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.35,
                color: "rgba(255,255,255,0.95)",
              }}
            >
              {title}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {getYear(item)}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function peopleRow(items: TmdbPerson[]) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        overflowX: "auto",
        paddingBottom: 8,
      }}
    >
      {items.slice(0, 12).map((person) => {
        const photo = person.profile_path
          ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
          : null;

        return (
          <Link
            key={person.id}
            href={`/actor/${person.id}`}
            style={{
              textDecoration: "none",
              color: "white",
              width: 150,
              minWidth: 150,
              flex: "0 0 150px",
            }}
          >
            {photo ? (
              <img
                src={photo}
                alt={person.name}
                style={{
                  width: 150,
                  height: 190,
                  objectFit: "cover",
                  borderRadius: 18,
                  display: "block",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 150,
                  height: 190,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            )}

            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.35,
                color: "rgba(255,255,255,0.95)",
              }}
            >
              {person.name}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function screenshotCard(src: string, alt: string) {
  return (
    <div
      style={{
        borderRadius: 26,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#111",
        boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
        }}
      />
    </div>
  );
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      heroTitle: "The social network for movies and series.",
      heroText:
        "Track what you watch, rate titles, create Peeklists, discover actors, explore awards, and follow what people around you are watching in real time.",
      createAccount: "Create account",
      downloadApp: "Download app",
      discoverTitle: "Discover top-rated movies and TV series",
      discoverText:
        "A discovery layer that combines cinema, television, people, awards and social taste in one place.",
      peopleTitle: "Popular people",
      peopleText:
        "Go beyond titles. Discover actors, creators and faces shaping what everyone is watching now.",
      profileTitle: "Build your identity as a viewer",
      profileText:
        "Your profile is more than a diary. It is your public taste map: watched titles, followers, following, watchlist and Peeklists.",
      socialTitle: "A social feed built for film and series culture",
      socialText:
        "See what your friends watched, rated, saved and discussed. Peekr turns passive tracking into an active social experience.",
      whyTitle: "Why Peekr feels different",
      why1: "Movies and TV series in one place",
      why2: "Real social activity, not just logging",
      why3: "Peeklists made to share taste",
      why4: "People, titles and awards discovery",
      why5: "Designed mobile-first, but powerful on web",
      ctaTitle: "Start building your taste graph.",
      ctaText:
        "Create your account, track what you watch, follow friends and discover your next obsession.",
    },
    es: {
      heroTitle: "La red social para películas y series.",
      heroText:
        "Lleva registro de lo que ves, califica títulos, crea Peeklists, descubre actores, explora premios y sigue en tiempo real lo que otras personas están viendo.",
      createAccount: "Crear cuenta",
      downloadApp: "Bajar app",
      discoverTitle: "Descubre películas y series top rated",
      discoverText:
        "Una capa de descubrimiento que une cine, televisión, personas, premios y gusto social en un solo lugar.",
      peopleTitle: "Personas populares",
      peopleText:
        "Ve más allá de los títulos. Descubre actores, creadores y rostros que están definiendo lo que todos están viendo.",
      profileTitle: "Construye tu identidad como viewer",
      profileText:
        "Tu perfil es más que un diario. Es tu mapa público de gustos: vistos, seguidores, siguiendo, watchlist y Peeklists.",
      socialTitle: "Un feed social hecho para la cultura del cine y las series",
      socialText:
        "Mira qué vieron, calificaron, guardaron y comentaron tus amigos. Peekr convierte el tracking pasivo en una experiencia social activa.",
      whyTitle: "Por qué Peekr se siente diferente",
      why1: "Películas y series en un mismo lugar",
      why2: "Actividad social real, no solo logging",
      why3: "Peeklists hechas para compartir gusto",
      why4: "Descubrimiento de personas, títulos y premios",
      why5: "Diseñado mobile-first, pero fuerte en web",
      ctaTitle: "Empieza a construir tu mapa de gustos.",
      ctaText:
        "Crea tu cuenta, registra lo que ves, sigue a tus amigos y descubre tu próxima obsesión.",
    },
    pt: {
      heroTitle: "A rede social para filmes e séries.",
      heroText:
        "Registre o que você assiste, avalie títulos, crie Peeklists, descubra atores, explore premiações e acompanhe em tempo real o que as pessoas estão vendo.",
      createAccount: "Criar conta",
      downloadApp: "Baixar app",
      discoverTitle: "Descubra filmes e séries top rated",
      discoverText:
        "Uma camada de descoberta que reúne cinema, televisão, pessoas, premiações e gosto social em um só lugar.",
      peopleTitle: "Pessoas populares",
      peopleText:
        "Vá além dos títulos. Descubra atores, criadores e rostos que estão moldando o que todo mundo está assistindo agora.",
      profileTitle: "Construa sua identidade como viewer",
      profileText:
        "Seu perfil é mais que um diário. É o seu mapa público de gosto: vistos, seguidores, seguindo, watchlist e Peeklists.",
      socialTitle: "Um feed social feito para a cultura de filmes e séries",
      socialText:
        "Veja o que seus amigos assistiram, avaliaram, salvaram e comentaram. Peekr transforma tracking passivo em experiência social ativa.",
      whyTitle: "Por que Peekr é diferente",
      why1: "Filmes e séries no mesmo lugar",
      why2: "Atividade social real, não só logging",
      why3: "Peeklists feitas para compartilhar gosto",
      why4: "Descoberta de pessoas, títulos e premiações",
      why5: "Criado mobile-first, mas forte no web",
      ctaTitle: "Comece a construir seu mapa de gosto.",
      ctaText:
        "Crie sua conta, registre o que assiste, siga seus amigos e descubra sua próxima obsessão.",
    },
  }[lang];

  const { topMovies, topTV, popularPeople } = await getHomeData(lang);

  const screenshots = {
    en: {
      hero: "/home/feed-en.png",
      profile: "/home/profile-en.png",
      actor: "/home/actor-es.png",
      social: "/home/feed-en.png",
      explore: "/home/explore-es.png",
    },
    es: {
      hero: "/home/explore-es.png",
      profile: "/home/profile-es.png",
      actor: "/home/actor-es.png",
      social: "/home/feed-es.png",
      explore: "/home/explore-es.png",
    },
    pt: {
      hero: "/home/feed-pt.png",
      profile: "/home/profile-es.png",
      actor: "/home/actor-pt.png",
      social: "/home/feed-pt.png",
      explore: "/home/explore-es.png",
    },
  }[lang];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 72 }}>
      {/* HERO */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 28,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(250,0,130,0.12)",
              color: BRAND,
              fontWeight: 800,
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            Peekr
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 62,
              lineHeight: 0.98,
              letterSpacing: "-0.05em",
              fontWeight: 900,
              color: "white",
              maxWidth: 760,
            }}
          >
            {t.heroTitle}
          </h1>

          <p
            style={{
              marginTop: 20,
              fontSize: 18,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.74)",
              maxWidth: 700,
            }}
          >
            {t.heroText}
          </p>

          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginTop: 26,
            }}
          >
            <Link
              href="/signup"
              style={{
                background: BRAND,
                color: "white",
                textDecoration: "none",
                padding: "15px 20px",
                borderRadius: 16,
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              {t.createAccount}
            </Link>

            <a
              href="mailto:info@peekr.app?subject=Peekr%20App"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "white",
                textDecoration: "none",
                padding: "15px 20px",
                borderRadius: 16,
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              {t.downloadApp}
            </a>
          </div>
        </div>

        <div>{screenshotCard(screenshots.hero, "Peekr hero")}</div>
      </section>

      {/* DISCOVER */}
      <section>
        {sectionTitle(t.discoverTitle, t.discoverText)}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 28,
          }}
        >
          {screenshotCard(screenshots.explore, "Peekr explore")}
          <div>{titleRow(topMovies, "movie")}</div>
          <div>{titleRow(topTV, "tv")}</div>
        </div>
      </section>

      {/* POPULAR PEOPLE */}
      <section>
        {sectionTitle(t.peopleTitle, t.peopleText)}
        <div>{peopleRow(popularPeople)}</div>
      </section>

      {/* PROFILE */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "0.95fr 1.05fr",
          gap: 28,
          alignItems: "center",
        }}
      >
        <div>{screenshotCard(screenshots.profile, "Peekr profile")}</div>

        <div>
          {sectionTitle(t.profileTitle, t.profileText)}

          <div
            style={{
              display: "grid",
              gap: 14,
              marginTop: 18,
            }}
          >
            {[t.why1, t.why2, t.why3].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  color: "rgba(255,255,255,0.88)",
                  fontSize: 16,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: BRAND,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACTOR + SOCIAL */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 28,
          alignItems: "start",
        }}
      >
        <div>
          {screenshotCard(screenshots.actor, "Peekr actor page")}
          <div style={{ marginTop: 18 }}>
            {sectionTitle(t.peopleTitle, t.peopleText)}
          </div>
        </div>

        <div>
          {screenshotCard(screenshots.social, "Peekr social feed")}
          <div style={{ marginTop: 18 }}>
            {sectionTitle(t.socialTitle, t.socialText)}
          </div>
        </div>
      </section>

      {/* WHY PEEKR */}
      <section
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 28,
          padding: 28,
        }}
      >
        {sectionTitle(t.whyTitle)}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 16,
            marginTop: 10,
          }}
        >
          {[t.why1, t.why2, t.why3, t.why4, t.why5].map((item) => (
            <div
              key={item}
              style={{
                borderRadius: 18,
                padding: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                minHeight: 110,
                color: "rgba(255,255,255,0.88)",
                fontWeight: 700,
                lineHeight: 1.5,
                fontSize: 15,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section
        style={{
          textAlign: "center",
          padding: "18px 0 8px 0",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 46,
            lineHeight: 1.02,
            color: "white",
            fontWeight: 900,
            letterSpacing: "-0.04em",
          }}
        >
          {t.ctaTitle}
        </h2>

        <p
          style={{
            margin: "18px auto 0 auto",
            maxWidth: 760,
            color: "rgba(255,255,255,0.72)",
            fontSize: 18,
            lineHeight: 1.7,
          }}
        >
          {t.ctaText}
        </p>

        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 28,
          }}
        >
          <Link
            href="/signup"
            style={{
              background: BRAND,
              color: "white",
              textDecoration: "none",
              padding: "15px 20px",
              borderRadius: 16,
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            {t.createAccount}
          </Link>

          <a
            href="mailto:info@peekr.app?subject=Peekr%20App"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "white",
              textDecoration: "none",
              padding: "15px 20px",
              borderRadius: 16,
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            {t.downloadApp}
          </a>
        </div>
      </section>
    </div>
  );
}
