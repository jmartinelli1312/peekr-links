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

async function fetchTMDB(url: string) {
  const res = await fetch(url, { next: { revalidate: 3600 } });
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
  const { data } = await supabase
    .from("peeklists")
    .select("id,title,cover_url")
    .limit(12);

  return data || [];
}

async function searchTitles(q: string) {
  const data = await fetchTMDB(
    `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}`
  );

  return (data?.results || []).filter(
    (i: any) => i.media_type === "movie" || i.media_type === "tv"
  );
}

async function searchPeople(q: string) {
  const data = await fetchTMDB(
    `${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}`
  );

  return data?.results || [];
}

async function searchUsers(q: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(12);

  return data || [];
}

function PosterRow({ items, type }: { items: any[]; type: "movie" | "tv" }) {
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
          {item.poster_path && (
            <img
              src={`${IMG}${item.poster_path}`}
              style={{
                width: "160px",
                aspectRatio: "2 / 3",
                objectFit: "cover",
                borderRadius: "14px",
                display: "block",
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

function Bubble({ label, active, href }: any) {
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
        border: `1px solid ${
          active ? BRAND : "rgba(255,255,255,0.12)"
        }`,
        color: "#fff",
      }}
    >
      {label}
    </Link>
  );
}

function UsersGrid({ items }: { items: any[] }) {
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
          {u.avatar_url && (
            <img
              src={u.avatar_url}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
              }}
            />
          )}

          <div>
            <div style={{ fontWeight: 700 }}>
              {u.display_name || u.username}
            </div>

            <div style={{ opacity: 0.6 }}>
              @{u.username}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function PeeklistsRow({ items }: { items: any[] }) {
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
      {items.map((pl) => (
        <Link
          key={pl.id}
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
          {pl.cover_url && (
            <img
              src={pl.cover_url}
              style={{
                width: "100%",
                height: 150,
                objectFit: "cover",
              }}
            />
          )}

          <div style={{ padding: 12 }}>{pl.title}</div>
        </Link>
      ))}
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

  const { trendingMovies, trendingTV, topMovies, topTV } =
    await getExploreData();

  const peeklists = await getPeeklists();

  let titleResults: any[] = [];
  let peopleResults: any[] = [];
  let userResults: any[] = [];

  if (query) {
    if (tab === "people") peopleResults = await searchPeople(query);
    else if (tab === "users") userResults = await searchUsers(query);
    else titleResults = await searchTitles(query);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      
      {/* SEARCH BAR */}
      <section>
        <h1 style={{ fontSize: 42, fontWeight: 900 }}>Explore</h1>

        <form
          action="/explore"
          method="GET"
          style={{
            marginTop: 20,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search movies, series, cast, crew or users"
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
            }}
          />

          {query && (
            <Link
              href="/explore"
              style={{
                padding: "12px",
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
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <Bubble
              label="Titles"
              active={tab === "titles"}
              href={`/explore?q=${query}&tab=titles`}
            />
            <Bubble
              label="Cast & Crew"
              active={tab === "people"}
              href={`/explore?q=${query}&tab=people`}
            />
            <Bubble
              label="Users"
              active={tab === "users"}
              href={`/explore?q=${query}&tab=users`}
            />
          </div>
        )}
      </section>

      {/* SEARCH RESULTS */}
      {query && (
        <section>
          {tab === "users" && <UsersGrid items={userResults} />}
        </section>
      )}

      {/* DISCOVERY */}
      {!query && (
        <>
          <section>
            <h2>Peeklists</h2>
            <PeeklistsRow items={peeklists} />
          </section>

          <section>
            <h2>Trending Movies</h2>
            <PosterRow items={trendingMovies} type="movie" />
          </section>

          <section>
            <h2>Trending TV</h2>
            <PosterRow items={trendingTV} type="tv" />
          </section>

          <section>
            <h2>Top Rated Movies</h2>
            <PosterRow items={topMovies} type="movie" />
          </section>

          <section>
            <h2>Top Rated TV</h2>
            <PosterRow items={topTV} type="tv" />
          </section>
        </>
      )}
    </div>
  );
}
