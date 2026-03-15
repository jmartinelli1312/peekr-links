export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w342";
const PERSON = "https://image.tmdb.org/t/p/w185";
const BRAND = "#FA0082";

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

function SectionHeader({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function ScreenshotCard({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="shot-card">
      <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} />
    </div>
  );
}

function TitleRow({
  items,
  type,
}: {
  items: TmdbTitle[];
  type: "movie" | "tv";
}) {
  return (
    <div className="scroll-row">
      {items.slice(0, 12).map((item) => {
        const title = item.title || item.name || "Untitled";
        const poster = item.poster_path ? `${POSTER}${item.poster_path}` : null;

        return (
          <Link
            key={`${type}-${item.id}`}
            href={`/title/${type}/${item.id}`}
            className="poster-card"
          >
            {poster ? (
              <img src={poster} alt={title} className="poster-image" />
            ) : (
              <div className="poster-fallback" />
            )}

            <div className="poster-meta">
              <div className="poster-title">{title}</div>
              <div className="poster-year">{getYear(item)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PeopleRow({ items }: { items: TmdbPerson[] }) {
  return (
    <div className="scroll-row">
      {items.slice(0, 12).map((person) => {
        const photo = person.profile_path
          ? `${PERSON}${person.profile_path}`
          : null;

        return (
          <Link
            key={person.id}
            href={`/actor/${person.id}`}
            className="person-card"
          >
            {photo ? (
              <img src={photo} alt={person.name} className="person-image" />
            ) : (
              <div className="person-fallback" />
            )}

            <div className="person-name">{person.name}</div>
          </Link>
        );
      })}
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
        "Track what you watch, rate titles, create Peeklists, discover actors, and follow what people around you are watching in real time.",
      createAccount: "Create account",
      downloadApp: "Download app",
      discoverTitle: "Discover top-rated movies and TV series",
      discoverText:
        "Explore cinema, television and people with a product built for discovery and taste.",
      peopleTitle: "Popular people",
      peopleText:
        "Go beyond titles and discover the actors and creators shaping what everyone is watching now.",
      profileTitle: "Build your identity as a viewer",
      profileText:
        "Your profile is more than a diary. It is your public taste map: watched titles, followers, following, watchlist and Peeklists.",
      socialTitle: "A social feed built for film and series culture",
      socialText:
        "See what your friends watched, rated, saved and discussed. Peekr turns passive tracking into active social discovery.",
      whyTitle: "Why Peekr feels different",
      why1: "Movies and TV series in one place",
      why2: "Real social activity, not just logging",
      why3: "Peeklists designed to share taste",
      why4: "Discovery of people, titles and awards",
      why5: "Mobile-first and web-ready",
      ctaTitle: "Start building your taste graph.",
      ctaText:
        "Create your account, track what you watch, follow friends and discover your next obsession.",
    },
    es: {
      heroTitle: "La red social para películas y series.",
      heroText:
        "Lleva registro de lo que ves, califica títulos, crea Peeklists, descubre actores y sigue en tiempo real lo que otras personas están viendo.",
      createAccount: "Crear cuenta",
      downloadApp: "Bajar app",
      discoverTitle: "Descubre películas y series top rated",
      discoverText:
        "Explora cine, televisión y personas con un producto creado para descubrimiento y gusto.",
      peopleTitle: "Personas populares",
      peopleText:
        "Ve más allá de los títulos y descubre actores y creadores que están definiendo lo que todos están viendo.",
      profileTitle: "Construye tu identidad como viewer",
      profileText:
        "Tu perfil es más que un diario. Es tu mapa público de gustos: vistos, seguidores, siguiendo, watchlist y Peeklists.",
      socialTitle: "Un feed social hecho para la cultura del cine y las series",
      socialText:
        "Mira qué vieron, calificaron, guardaron y comentaron tus amigos. Peekr convierte el tracking pasivo en descubrimiento social activo.",
      whyTitle: "Por qué Peekr se siente diferente",
      why1: "Películas y series en un mismo lugar",
      why2: "Actividad social real, no solo logging",
      why3: "Peeklists hechas para compartir gusto",
      why4: "Descubrimiento de personas, títulos y premios",
      why5: "Diseñado mobile-first y fuerte en web",
      ctaTitle: "Empieza a construir tu mapa de gustos.",
      ctaText:
        "Crea tu cuenta, registra lo que ves, sigue a tus amigos y descubre tu próxima obsesión.",
    },
    pt: {
      heroTitle: "A rede social para filmes e séries.",
      heroText:
        "Registre o que você assiste, avalie títulos, crie Peeklists, descubra atores e acompanhe em tempo real o que as pessoas estão vendo.",
      createAccount: "Criar conta",
      downloadApp: "Baixar app",
      discoverTitle: "Descubra filmes e séries top rated",
      discoverText:
        "Explore cinema, televisão e pessoas com um produto criado para descoberta e gosto.",
      peopleTitle: "Pessoas populares",
      peopleText:
        "Vá além dos títulos e descubra atores e criadores que estão moldando o que todo mundo está assistindo agora.",
      profileTitle: "Construa sua identidade como viewer",
      profileText:
        "Seu perfil é mais que um diário. É o seu mapa público de gosto: vistos, seguidores, seguindo, watchlist e Peeklists.",
      socialTitle: "Um feed social feito para a cultura de filmes e séries",
      socialText:
        "Veja o que seus amigos assistiram, avaliaram, salvaram e comentaram. Peekr transforma tracking passivo em descoberta social ativa.",
      whyTitle: "Por que Peekr é diferente",
      why1: "Filmes e séries no mesmo lugar",
      why2: "Atividade social real, não só logging",
      why3: "Peeklists feitas para compartilhar gosto",
      why4: "Descoberta de pessoas, títulos e premiações",
      why5: "Criado mobile-first e forte no web",
      ctaTitle: "Comece a construir seu mapa de gosto.",
      ctaText:
        "Crie sua conta, registre o que assiste, siga seus amigos e descubra sua próxima obsessão.",
    },
  }[lang];

  const { topMovies, topTV, popularPeople } = await getHomeData(lang);

  const screenshots = {
    en: {
      hero: "/home/feed-en.jpg",
      explore: "/home/explore-es.jpg",
      profile: "/home/profile-en.jpg",
      actor: "/home/actor-es.jpg",
      social: "/home/feed-en.jpg",
    },
    es: {
      hero: "/home/explore-es.jpg",
      explore: "/home/explore-es.jpg",
      profile: "/home/profile-es.jpg",
      actor: "/home/actor-es.jpg",
      social: "/home/feed-es.jpg",
    },
    pt: {
      hero: "/home/feed-pt.jpg",
      explore: "/home/explore-es.jpg",
      profile: "/home/profile-es.jpg",
      actor: "/home/actor-pt.jpg",
      social: "/home/feed-pt.jpg",
    },
  }[lang];

  return (
    <>
      <style>{`
        .home-page {
          display: flex;
          flex-direction: column;
          gap: 72px;
        }

        .hero-grid,
        .two-col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
          align-items: center;
        }

        .hero-copy h1 {
          margin: 0;
          font-size: 44px;
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
        }

        .hero-copy p {
          margin: 18px 0 0 0;
          font-size: 16px;
          line-height: 1.7;
          color: rgba(255,255,255,0.74);
          max-width: 680px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(250,0,130,0.12);
          color: ${BRAND};
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 18px;
        }

        .hero-actions,
        .cta-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 24px;
        }

        .btn-primary,
        .btn-secondary {
          text-decoration: none;
          border-radius: 16px;
          padding: 14px 18px;
          font-weight: 800;
          font-size: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .btn-primary {
          background: ${BRAND};
          color: white;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.10);
          color: white;
        }

        .shot-card {
          width: 100%;
          border-radius: 26px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          background: #111;
          box-shadow: 0 18px 40px rgba(0,0,0,0.28);
        }

        .shot-card img {
          width: 100%;
          height: auto;
          display: block;
          object-fit: cover;
        }

        .section-header {
          margin-bottom: 18px;
        }

        .section-header h2 {
          margin: 0;
          font-size: 30px;
          line-height: 1.04;
          color: white;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .section-header p {
          margin: 10px 0 0 0;
          color: rgba(255,255,255,0.70);
          font-size: 15px;
          line-height: 1.65;
          max-width: 820px;
        }

        .scroll-row {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
        }

        .poster-card,
        .person-card {
          text-decoration: none;
          color: white;
          flex: 0 0 auto;
        }

        .poster-card {
          width: 136px;
          min-width: 136px;
        }

        .poster-image,
        .poster-fallback {
          width: 136px;
          aspect-ratio: 2 / 3;
          border-radius: 16px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
          box-shadow: 0 14px 36px rgba(0,0,0,0.35);
        }

        .poster-meta {
          margin-top: 10px;
        }

        .poster-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.35;
          color: rgba(255,255,255,0.95);
        }

        .poster-year {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255,255,255,0.55);
        }

        .person-card {
          width: 132px;
          min-width: 132px;
        }

        .person-image,
        .person-fallback {
          width: 132px;
          aspect-ratio: 3 / 4;
          border-radius: 16px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
          box-shadow: 0 12px 30px rgba(0,0,0,0.28);
        }

        .person-name {
          margin-top: 10px;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.35;
          color: rgba(255,255,255,0.95);
        }

        .why-box {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          border-radius: 28px;
          padding: 22px;
        }

        .why-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-top: 8px;
        }

        .why-card {
          border-radius: 18px;
          padding: 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.88);
          font-weight: 700;
          line-height: 1.5;
          font-size: 15px;
        }

        .cta-final {
          text-align: center;
          padding: 6px 0 8px 0;
        }

        .cta-final h2 {
          margin: 0;
          font-size: 38px;
          line-height: 1.02;
          color: white;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .cta-final p {
          margin: 16px auto 0 auto;
          max-width: 760px;
          color: rgba(255,255,255,0.72);
          font-size: 16px;
          line-height: 1.7;
        }

        @media (min-width: 900px) {
          .hero-grid {
            grid-template-columns: 1.02fr 0.98fr;
          }

          .two-col {
            grid-template-columns: 1fr 1fr;
            align-items: start;
          }

          .hero-copy h1 {
            font-size: 62px;
          }

          .section-header h2 {
            font-size: 34px;
          }

          .poster-card {
            width: 165px;
            min-width: 165px;
          }

          .poster-image,
          .poster-fallback {
            width: 165px;
          }

          .person-card {
            width: 150px;
            min-width: 150px;
          }

          .person-image,
          .person-fallback {
            width: 150px;
          }

          .why-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .cta-final h2 {
            font-size: 46px;
          }
        }
      `}</style>

      <div className="home-page">
        <section className="hero-grid">
          <div className="hero-copy">
            <div className="badge">Peekr</div>

            <h1>{t.heroTitle}</h1>

            <p>{t.heroText}</p>

            <div className="hero-actions">
              <Link href="/signup" className="btn-primary">
                {t.createAccount}
              </Link>

              <a
                href="mailto:info@peekr.app?subject=Peekr%20App"
                className="btn-secondary"
              >
                {t.downloadApp}
              </a>
            </div>
          </div>

          <ScreenshotCard src={screenshots.hero} alt="Peekr hero" priority />
        </section>

        <section>
          <SectionHeader title={t.discoverTitle} text={t.discoverText} />
          <ScreenshotCard src={screenshots.explore} alt="Peekr explore" />
          <div style={{ marginTop: 24 }}>{TitleRow({ items: topMovies, type: "movie" })}</div>
          <div style={{ marginTop: 20 }}>{TitleRow({ items: topTV, type: "tv" })}</div>
        </section>

        <section>
          <SectionHeader title={t.peopleTitle} text={t.peopleText} />
          {PeopleRow({ items: popularPeople })}
        </section>

        <section className="two-col">
          <ScreenshotCard src={screenshots.profile} alt="Peekr profile" />
          <div>
            <SectionHeader title={t.profileTitle} text={t.profileText} />
            <div className="why-grid">
              {[t.why1, t.why2, t.why3].map((item) => (
                <div key={item} className="why-card">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="two-col">
          <div>
            <ScreenshotCard src={screenshots.actor} alt="Peekr actor page" />
            <div style={{ marginTop: 18 }}>
              <SectionHeader title={t.peopleTitle} text={t.peopleText} />
            </div>
          </div>

          <div>
            <ScreenshotCard src={screenshots.social} alt="Peekr social feed" />
            <div style={{ marginTop: 18 }}>
              <SectionHeader title={t.socialTitle} text={t.socialText} />
            </div>
          </div>
        </section>

        <section className="why-box">
          <SectionHeader title={t.whyTitle} />
          <div className="why-grid">
            {[t.why1, t.why2, t.why3, t.why4, t.why5].map((item) => (
              <div key={item} className="why-card">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="cta-final">
          <h2>{t.ctaTitle}</h2>
          <p>{t.ctaText}</p>

          <div className="cta-actions">
            <Link href="/signup" className="btn-primary">
              {t.createAccount}
            </Link>

            <a
              href="mailto:info@peekr.app?subject=Peekr%20App"
              className="btn-secondary"
            >
              {t.downloadApp}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
