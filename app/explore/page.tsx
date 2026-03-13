export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w342";
const BRAND = "#FA0082";

type SearchParams = {
  q?: string;
  tab?: string;
};

type ExplorePageProps = {
  searchParams: Promise<SearchParams>;
};

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  media_type?: "movie" | "tv" | "person";
};

type PersonItem = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string | null;
};

type ProfileItem = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type PeeklistItem = {
  id: string | number;
  title?: string | null;
  cover_url?: string | null;
};

async function fetchTMDB<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}

async function getExploreData() {
  const [trendingMovies, trendingTV, topMovies, topTV] = await Promise.all([
    fetchTMDB<{ results: TmdbItem[] }>(
      `${TMDB_BASE}/trending/movie/week?api_key=${TMDB_KEY}`
    ),
    fetchTMDB<{ results: TmdbItem[] }>(
      `${TMDB_BASE}/trending/tv/week?api_key=${TMDB_KEY}`
    ),
    fetchTMDB<{ results: TmdbItem[] }>(
      `${TMDB_BASE}/movie/top_rated?api_key=${TMDB_KEY}`
    ),
    fetchTMDB<{ results: TmdbItem[] }>(
      `${TMDB_BASE}/tv/top_rated?api_key=${TMDB_KEY}`
    ),
  ]);

  return {
    trendingMovies: trendingMovies?.results ?? [],
    trendingTV: trendingTV?.results ?? [],
    topMovies: topMovies?.results ?? [],
    topTV: topTV?.results ?? [],
  };
}

async function getPeeklists(): Promise<PeeklistItem[]> {
  const { data } = await supabase
    .from("peeklists")
    .select("id,title,cover_url")
    .limit(12);

  return (data as PeeklistItem[] | null) ?? [];
}

async function searchTitles(q: string): Promise<TmdbItem[]> {
  const data = await fetchTMDB<{ results: TmdbItem[] }>(
    `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}`
  );

  return (data?.results ?? []).filter(
    (i) => i.media_type === "movie" || i.media_type === "tv"
  );
}

async function searchPeople(q: string): Promise<PersonItem[]> {
  const data = await fetchTMDB<{ results: PersonItem[] }>(
    `${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}`
  );

  return data?.results ?? [];
}

async function searchUsers(q: string): Promise<ProfileItem[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(12);

  return (data as ProfileItem[] | null) ?? [];
}

function Bubble({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        textDecoration: "none",
        fontWeight: 600,
        fontSize: 14,
        background: active ? BRAND : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? BRAND : "rgba(255,255,255,0.12)"}`,
        color: "#fff",
      }}
    >
      {label}
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 28,
        marginBottom: 18,
        color: BRAND,
        fontWeight: 800,
      }}
    >
      {children}
    </h2>
  );
}

function PosterRow({
  items,
  type,
}: {
  items: TmdbItem[];
  type: "movie" | "tv";
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        overflowX: "auto",
        paddingBottom: 10,
      }}
    >
      {items.slice(0, 20).map((item) => (
        <Link
          key={item.id}
          href={`/title/${type}/${item.id}`}
          style={{
            textDecoration: "none",
            color: "#fff",
            minWidth: 160,
            flex: "0 0 160px",
          }}
        >
          {item.poster_path ? (
            <img
              src={`${IMG}${item.poster_path}`}
              alt={item.title || item.name || "Poster"}
              style={{
                width: 160,
                aspectRatio: "2 / 3",
                objectFit: "cover",
                borderRadius: 14,
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: 160,
                aspectRatio: "2 / 3",
                borderRadius: 14,
                background: "rgba(255,255,255,0.08)",
              }}
            />
          )}

          <div style={{ marginTop: 6, fontSize: 14 }}>
            {item.title || item.name}
          </div>
        </Link>
      ))}
    </div>
  );
}

function TitleGrid({ items }: { items: TmdbItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
        gap: 18,
      }}
    >
      {items.map((item) => {
        const type = item.media_type === "tv" ? "tv" : "movie";

        return (
          <Link
            key={item.id}
            href={`/title/${type}/${item.id}`}
            style={{ textDecoration: "none", color: "#fff" }}
          >
            {item.poster_path ? (
              <img
                src={`${IMG}${item.poster_path}`}
                alt={item.title || item.name || "Poster"}
                style={{
                  width: "100%",
                  aspectRatio: "2 / 3",
                  objectFit: "cover",
                  borderRadius: 12,
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "2 / 3",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            )}

            <div style={{ marginTop: 8, fontWeight: 600 }}>
              {item.title || item.name}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PeopleGrid({ items }: { items: PersonItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
        gap: 18,
      }}
    >
      {items.map((p) => (
        <Link
          key={p.id}
          href={`/actor/${p.id}`}
          style={{
            textDecoration: "none",
            color: "#fff",
            background: "rgba(255,255,255,0.05)",
            padding: 12,
            borderRadius: 14,
          }}
        >
          {p.profile_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w185${p.profile_path}`}
              alt={p.name}
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderRadius: 10,
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
              }}
            />
          )}

          <div style={{ marginTop: 8, fontWeight: 600 }}>{p.name}</div>

          {p.known_for_department && (
            <div style={{ opacity: 0.6, fontSize: 13 }}>
              {p.known_for_department}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

function UsersGrid({ items }: { items: ProfileItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
        gap: 16,
      }}
    >
      {items.map((u) => (
        <Link
          key={u.id}
          href={`/user/${u.username}`}
          style={{
            display: "flex",
            gap: 12,
            padding: 12,
            background: "#111",
            borderRadius: 12,
            textDecoration: "none",
            color: "#fff",
          }}
        >
          {u.avatar_url ? (
            <img
              src={u.avatar_url}
              alt={u.username}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
              }}
            />
          )}

          <div>
            <div style={{ fontWeight: 700 }}>
              {u.display_name || u.username}
            </div>

            <div style={{ opacity: 0.6 }}>@{u.username}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function PeeklistsRow({ items }: { items: PeeklistItem[] }) {
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
      {items.map((pl) => (
        <Link
          key={String(pl.id)}
          href={`/peeklist/${pl.id}`}
          style={{
            minWidth: 260,
            textDecoration: "none",
            color: "#fff",
            background: "#111",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {pl.cover_url ? (
            <img
              src={pl.cover_url}
              alt={pl.title || "Peeklist"}
              style={{
                width: "100%",
                height: 150,
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: 150,
                background: "linear-gradient(135deg,#FA0082,rgba(255,255,255,0.08))",
              }}
            />
          )}

          <div style={{ padding: 12 }}>{pl.title || "Peeklist"}</div>
        </Link>
      ))}
    </div>
  );
}

export default async function ExplorePage({
  searchParams,
}: ExplorePageProps) {
  const { q = "", tab = "titles" } = await searchParams;
  const query = q.trim();

  const { trendingMovies, trendingTV, topMovies, topTV } =
    await getExploreData();

  const peeklists = await getPeeklists();

  let titleResults: TmdbItem[] = [];
  let peopleResults: PersonItem[] = [];
  let userResults: ProfileItem[] = [];

  if (query) {
    if (tab === "people") peopleResults = await searchPeople(query);
    else if (tab === "users") userResults = await searchUsers(query);
    else titleResults = await searchTitles(query);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      <section>
        <h1 style={{ fontSize: 42, fontWeight: 900, margin: 0 }}>Explore</h1>

        <form
          action="/explore"
          method="GET"
          style={{
            marginTop: 20,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search movies, series, cast, crew or users"
            style={{
              flex: "1 1 420px",
              minWidth: 260,
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
            }}
          />

          <input type="hidden" name="tab" value={tab} />

          {query && (
            <Link
              href="/explore"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.1)",
                textDecoration: "none",
                color: "#fff",
              }}
            >
              Clear
            </Link>
          )}

          <button
            type="submit"
            style={{
              background: BRAND,
              border: "none",
              padding: "14px 18px",
              borderRadius: 12,
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        {query && (
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Bubble
              label="Titles"
              active={tab === "titles"}
              href={`/explore?q=${encodeURIComponent(query)}&tab=titles`}
            />
            <Bubble
              label="Cast & Crew"
              active={tab === "people"}
              href={`/explore?q=${encodeURIComponent(query)}&tab=people`}
            />
            <Bubble
              label="Users"
              active={tab === "users"}
              href={`/explore?q=${encodeURIComponent(query)}&tab=users`}
            />
          </div>
        )}
      </section>

      {query && (
        <section>
          <SectionTitle>{`Search results for "${query}"`}</SectionTitle>

          {tab === "titles" && <TitleGrid items={titleResults} />}
          {tab === "people" && <PeopleGrid items={peopleResults} />}
          {tab === "users" && <UsersGrid items={userResults} />}
        </section>
      )}

      {!query && (
        <>
          <section>
            <SectionTitle>Peeklists</SectionTitle>
            <PeeklistsRow items={peeklists} />
          </section>

          <section>
            <SectionTitle>Trending Movies</SectionTitle>
            <PosterRow items={trendingMovies} type="movie" />
          </section>

          <section>
            <SectionTitle>Trending TV</SectionTitle>
            <PosterRow items={trendingTV} type="tv" />
          </section>

          <section>
            <SectionTitle>Top Rated Movies</SectionTitle>
            <PosterRow items={topMovies} type="movie" />
          </section>

          <section>
            <SectionTitle>Top Rated TV</SectionTitle>
            <PosterRow items={topTV} type="tv" />
          </section>
        </>
      )}
    </div>
  );
}
