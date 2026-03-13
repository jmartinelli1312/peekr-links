export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
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
    .select("*")
    .limit(12);

  return data || [];
}

async function searchTitles(q: string) {
  const data = await fetchTMDB(
    `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(
      q
    )}`
  );

  return (data?.results || []).filter(
    (item: any) => item.media_type === "movie" || item.media_type === "tv"
  );
}

async function searchPeople(q: string) {
  const data = await fetchTMDB(
    `${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(
      q
    )}`
  );

  return data?.results || [];
}

async function searchUsers(q: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${q}%`)
    .limit(12);

  return data || [];
}

function SectionTitle({ children }: { children: any }) {
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

function BubbleTab({
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

function PosterRow({
  items,
  type,
}: {
  items: any[];
  type: "movie" | "tv";
}) {
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
      {items.slice(0, 20).map((item) => (
        <Link
          key={item.id}
          href={`/title/${type}/${item.id}`}
          style={{ textDecoration: "none", color: "#fff" }}
        >
          {item.poster_path && (
            <img
              src={`${TMDB_IMG}${item.poster_path}`}
              style={{
                width: 160,
                height: 240,
                borderRadius: 12,
                objectFit: "cover",
              }}
            />
          )}
        </Link>
      ))}
    </div>
  );
}

function TitleGrid({ items }: { items: any[] }) {
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
            {item.poster_path && (
              <img
                src={`${TMDB_IMG}${item.poster_path}`}
                style={{
                  width: "100%",
                  borderRadius: 12,
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

function PeopleGrid({ items }: { items: any[] }) {
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
          {p.profile_path && (
            <img
              src={`https://image.tmdb.org/t/p/w185${p.profile_path}`}
              style={{
                width: "100%",
                borderRadius: 10,
              }}
            />
          )}

          <div style={{ marginTop: 8, fontWeight: 600 }}>
            {p.name}
          </div>
        </Link>
      ))}
    </div>
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
            alignItems: "center",
            gap: 12,
            padding: 14,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 14,
            textDecoration: "none",
            color: "#fff",
          }}
        >
          {u.avatar_url && (
            <img
              src={u.avatar_url}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
              }}
            />
          )}

          <div>
            <div style={{ fontWeight: 700 }}>
              @{u.username}
            </div>

            {u.display_name && (
              <div style={{ opacity: 0.7 }}>
                {u.display_name}
              </div>
            )}
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
            background: "rgba(255,255,255,0.05)",
            borderRadius: 16,
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

          <div style={{ padding: 14, fontWeight: 600 }}>
            {pl.title || "Peeklist"}
          </div>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
      <section>
        <h1 style={{ fontSize: 42, fontWeight: 900 }}>Explore</h1>

        <form
          action="/explore"
          method="GET"
          style={{
            marginTop: 20,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
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
                padding: "10px 12px",
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
            <BubbleTab
              label="Titles"
              active={tab === "titles"}
              href={`/explore?q=${query}&tab=titles`}
            />

            <BubbleTab
              label="Cast & Crew"
              active={tab === "people"}
              href={`/explore?q=${query}&tab=people`}
            />

            <BubbleTab
              label="Users"
              active={tab === "users"}
              href={`/explore?q=${query}&tab=users`}
            />
          </div>
        )}
      </section>

      {query && (
        <section>
          <SectionTitle>
            Search results for "{query}"
          </SectionTitle>

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
