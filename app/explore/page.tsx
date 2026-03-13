export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const BRAND = "#FA0082";

type SearchParams = {
  q?: string;
  tab?: string;
};

async function fetchTMDB(url: string) {
  const res = await fetch(url, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;
  return res.json();
}

async function getExploreData() {
  const [trendingMovies, trendingTV, topMovies, topTV] = await Promise.all([
    fetchTMDB(`${TMDB_BASE}/trending/movie/week?api_key=${TMDB_KEY}`),
    fetchTMDB(`${TMDB_BASE}/trending/tv/week?api_key=${TMDB_KEY}`),
    fetchTMDB(`${TMDB_BASE}/movie/top_rated?api_key=${TMDB_KEY}`),
    fetchTMDB(`${TMDB_BASE}/tv/top_rated?api_key=${TMDB_KEY}`),
  ]);

  return {
    trendingMovies: trendingMovies?.results || [],
    trendingTV: trendingTV?.results || [],
    topMovies: topMovies?.results || [],
    topTV: topTV?.results || [],
  };
}

async function getPeeklists() {
  try {
    const { data, error } = await supabase.from("peeklists").select("*").limit(12);

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

async function searchTitles(q: string) {
  const data = await fetchTMDB(
    `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&language=en-US&query=${encodeURIComponent(
      q
    )}`
  );

  return (data?.results || []).filter(
    (item: any) => item.media_type === "movie" || item.media_type === "tv"
  );
}

async function searchPeople(q: string) {
  const data = await fetchTMDB(
    `${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&language=en-US&query=${encodeURIComponent(
      q
    )}`
  );

  return data?.results || [];
}

async function searchUsers(q: string) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${q}%`)
      .limit(12);

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function sectionTitle(title: string) {
  return (
    <h2
      style={{
        fontSize: "28px",
        marginBottom: "18px",
        color: BRAND,
        fontWeight: 800,
        letterSpacing: "-0.02em",
      }}
    >
      {title}
    </h2>
  );
}

function SearchPill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        padding: "10px 14px",
        borderRadius: "999px",
        border: `1px solid ${active ? BRAND : "rgba(255,255,255,0.12)"}`,
        color: active ? "#fff" : "rgba(255,255,255,0.75)",
        background: active ? BRAND : "rgba(255,255,255,0.04)",
        fontSize: "14px",
        fontWeight: 600,
      }}
    >
      {label}
    </Link>
  );
}

function HorizontalPosterRow({
  items,
  type,
}: {
  items: any[];
  type: "movie" | "tv";
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        overflowX: "auto",
        paddingBottom: "8px",
      }}
    >
      {items.slice(0, 20).map((item) => {
        const poster = item.poster_path
          ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
          : null;

        return (
          <Link
            key={`${type}-${item.id}`}
            href={`/title/${type}/${item.id}`}
            style={{
              textDecoration: "none",
              color: "#fff",
              minWidth: "160px",
              maxWidth: "160px",
              flex: "0 0 160px",
            }}
          >
            <div>
              {poster ? (
                <img
                  src={poster}
                  alt={item.title || item.name || "Poster"}
                  style={{
                    width: "160px",
                    height: "240px",
                    objectFit: "cover",
                    borderRadius: "14px",
                    display: "block",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "160px",
                    height: "240px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.08)",
                  }}
                />
              )}

              <div
                style={{
                  marginTop: "8px",
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.88)",
                  lineHeight: 1.35,
                  fontWeight: 500,
                }}
              >
                {item.title || item.name}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SearchTitleGrid({ items }: { items: any[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
        gap: "18px",
      }}
    >
      {items.map((item) => {
        const mediaType = item.media_type === "tv" ? "tv" : "movie";
        const poster = item.poster_path
          ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
          : null;

        return (
          <Link
            key={`${mediaType}-${item.id}`}
            href={`/title/${mediaType}/${item.id}`}
            style={{ textDecoration: "none", color: "#fff" }}
          >
            {poster ? (
              <img
                src={poster}
                alt={item.title || item.name || "Poster"}
                style={{
                  width: "100%",
                  aspectRatio: "2 / 3",
                  objectFit: "cover",
                  borderRadius: "14px",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "2 / 3",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            )}

            <div
              style={{
                marginTop: "8px",
                fontSize: "14px",
                color: "rgba(255,255,255,0.88)",
                fontWeight: 600,
              }}
            >
              {item.title || item.name}
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {mediaType === "movie" ? "Movie" : "TV"}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PeopleGrid({ items }: { items: any[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
        gap: "18px",
      }}
    >
      {items.map((person) => {
        const img = person.profile_path
          ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
          : null;

        return (
          <div
            key={person.id}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "16px",
              padding: "14px",
            }}
          >
            {img ? (
              <img
                src={img}
                alt={person.name}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  borderRadius: "12px",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            )}

            <div
              style={{
                marginTop: "10px",
                fontSize: "15px",
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {person.name}
            </div>

            {person.known_for_department && (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {person.known_for_department}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UsersGrid({ items }: { items: any[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
        gap: "16px",
      }}
    >
      {items.map((user) => {
        const username = user.username || "user";
        const avatar =
          user.avatar_url ||
          user.profile_image_url ||
          user.image_url ||
          null;

        return (
          <div
            key={user.id || username}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "16px",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt={username}
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "999px",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            )}

            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                @{username}
              </div>

              {user.display_name && (
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.65)",
                  }}
                >
                  {user.display_name}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PeeklistsRow({ items }: { items: any[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        overflowX: "auto",
        paddingBottom: "8px",
      }}
    >
      {items.map((list) => {
        const title =
          list.title ||
          list.name ||
          list.peeklist_name ||
          "Peeklist";

        const description =
          list.description ||
          list.subtitle ||
          "";

        const cover =
          list.cover_url ||
          list.cover_image_url ||
          list.image_url ||
          list.poster_url ||
          null;

        return (
          <div
            key={list.id || title}
            style={{
              minWidth: "260px",
              maxWidth: "260px",
              flex: "0 0 260px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "18px",
              overflow: "hidden",
            }}
          >
            {cover ? (
              <img
                src={cover}
                alt={title}
                style={{
                  width: "100%",
                  height: "150px",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "150px",
                  background:
                    "linear-gradient(135deg, rgba(250,0,130,0.35), rgba(255,255,255,0.06))",
                }}
              />
            )}

            <div style={{ padding: "14px" }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {title}
              </div>

              {description && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.65)",
                    lineHeight: 1.4,
                  }}
                >
                  {description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q = "", tab = "titles" } = await searchParams;
  const query = q.trim();

  const { trendingMovies, trendingTV, topMovies, topTV } = await getExploreData();
  const peeklists = await getPeeklists();

  let titleResults: any[] = [];
  let peopleResults: any[] = [];
  let userResults: any[] = [];

  if (query) {
    if (tab === "people") {
      peopleResults = await searchPeople(query);
    } else if (tab === "users") {
      userResults = await searchUsers(query);
    } else {
      titleResults = await searchTitles(query);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "56px",
      }}
    >
      {/* HERO / SEARCH */}
      <section>
        <h1
          style={{
            fontSize: "42px",
            lineHeight: 1.05,
            margin: 0,
            color: "#fff",
            fontWeight: 900,
            letterSpacing: "-0.03em",
          }}
        >
          Explore
        </h1>

        <p
          style={{
            marginTop: "12px",
            fontSize: "16px",
            color: "rgba(255,255,255,0.68)",
            maxWidth: "760px",
            lineHeight: 1.6,
          }}
        >
          Discover trending titles, top rated movies and series, and public Peeklists.
          Search across titles, cast & crew, and users.
        </p>

        <form
          action="/explore"
          method="GET"
          style={{
            marginTop: "22px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search movies, series, cast, crew or users..."
            style={{
              flex: "1 1 420px",
              minWidth: "260px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#fff",
              borderRadius: "14px",
              padding: "14px 16px",
              fontSize: "15px",
              outline: "none",
            }}
          />

          <input type="hidden" name="tab" value={tab} />

          <button
            type="submit"
            style={{
              background: BRAND,
              color: "#fff",
              border: "none",
              borderRadius: "14px",
              padding: "14px 18px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        <div
          style={{
            marginTop: "14px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <SearchPill
            href={`/explore?q=${encodeURIComponent(query)}&tab=titles`}
            active={tab === "titles"}
            label="Titles"
          />
          <SearchPill
            href={`/explore?q=${encodeURIComponent(query)}&tab=people`}
            active={tab === "people"}
            label="Cast/Crew"
          />
          <SearchPill
            href={`/explore?q=${encodeURIComponent(query)}&tab=users`}
            active={tab === "users"}
            label="Users"
          />
        </div>
      </section>

      {/* SEARCH RESULTS */}
      {query && (
        <section>
          {sectionTitle(`Search results for "${query}"`)}

          {tab === "titles" && <SearchTitleGrid items={titleResults} />}
          {tab === "people" && <PeopleGrid items={peopleResults} />}
          {tab === "users" && <UsersGrid items={userResults} />}

          {tab === "titles" && titleResults.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.6)" }}>No titles found.</div>
          )}

          {tab === "people" && peopleResults.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.6)" }}>No cast or crew found.</div>
          )}

          {tab === "users" && userResults.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.6)" }}>No users found.</div>
          )}
        </section>
      )}

      {/* PEEKLISTS */}
      {peeklists.length > 0 && (
        <section>
          {sectionTitle("Peeklists")}
          <PeeklistsRow items={peeklists} />
        </section>
      )}

      {/* TRENDING MOVIES */}
      <section>
        {sectionTitle("Trending Movies")}
        <HorizontalPosterRow items={trendingMovies} type="movie" />
      </section>

      {/* TRENDING TV */}
      <section>
        {sectionTitle("Trending TV")}
        <HorizontalPosterRow items={trendingTV} type="tv" />
      </section>

      {/* TOP RATED MOVIES */}
      <section>
        {sectionTitle("Top Rated Movies")}
        <HorizontalPosterRow items={topMovies} type="movie" />
      </section>

      {/* TOP RATED TV */}
      <section>
        {sectionTitle("Top Rated TV")}
        <HorizontalPosterRow items={topTV} type="tv" />
      </section>
    </div>
  );
}
