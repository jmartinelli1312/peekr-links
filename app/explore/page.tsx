export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { translations, getLang } from "@/lib/i18n";
import HorizontalScroller from "@/components/HorizontalScroller";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const BRAND = "#FA0082";

type SearchParams = {
  q?: string;
  tab?: string;
};

const lang = getLang();
const t = translations[lang as "en" | "es" | "pt"];

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
  const { data } = await supabase.from("peeklists").select("*").limit(12);
  return data || [];
}

async function searchTitles(q: string) {
  const data = await fetchTMDB(
    `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}`
  );

  return (data?.results || []).filter(
    (x: any) => x.media_type === "movie" || x.media_type === "tv"
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
    .ilike("username", `%${q}%`)
    .limit(12);

  return data || [];
}

function sectionTitle(title: string) {
  return (
    <h2
      style={{
        fontSize: "28px",
        marginBottom: "18px",
        color: BRAND,
        fontWeight: 800,
      }}
    >
      {title}
    </h2>
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
    <>
      {items.slice(0, 20).map((item) => {
        const poster = item.poster_path
          ? `${TMDB_IMG}${item.poster_path}`
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
            {poster ? (
              <img
                src={poster}
                alt={item.title || item.name}
                style={{
                  width: "160px",
                  height: "240px",
                  objectFit: "cover",
                  borderRadius: "14px",
                }}
              />
            ) : (
              <div
                style={{
                  width: "160px",
                  height: "240px",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.1)",
                }}
              />
            )}

            <div
              style={{
                marginTop: "8px",
                fontSize: "14px",
              }}
            >
              {item.title || item.name}
            </div>
          </Link>
        );
      })}
    </>
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
        const avatar = user.avatar_url || null;

        return (
          <Link
            key={user.id}
            href={`/user/${user.username}`}
            style={{
              textDecoration: "none",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              padding: "14px",
              display: "flex",
              gap: "12px",
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                }}
              />
            ) : (
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)",
                }}
              />
            )}

            <div>
              <div>@{user.username}</div>
              {user.display_name && (
                <div style={{ opacity: 0.7 }}>{user.display_name}</div>
              )}
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
          <Link
            key={person.id}
            href={`/person/${person.id}`}
            style={{
              textDecoration: "none",
              color: "#fff",
            }}
          >
            {img ? (
              <img
                src={img}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                }}
              />
            )}

            <div style={{ marginTop: "10px" }}>{person.name}</div>
          </Link>
        );
      })}
    </div>
  );
}

function PeeklistsRow({ items }: { items: any[] }) {
  return (
    <>
      {items.map((list) => {
        const cover = list.cover_url || null;

        return (
          <Link
            key={list.id}
            href={`/peeklist/${list.id}`}
            style={{
              minWidth: "260px",
              maxWidth: "260px",
              flex: "0 0 260px",
              textDecoration: "none",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "18px",
              overflow: "hidden",
            }}
          >
            {cover ? (
              <img
                src={cover}
                style={{
                  width: "100%",
                  height: "150px",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  height: "150px",
                  background:
                    "linear-gradient(135deg,#FA0082,rgba(255,255,255,0.1))",
                }}
              />
            )}

            <div style={{ padding: "14px" }}>
              <div style={{ fontWeight: 700 }}>
                {list.title || "Peeklist"}
              </div>
            </div>
          </Link>
        );
      })}
    </>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "56px" }}>
      <section>
        <h1 style={{ fontSize: "42px", fontWeight: 900 }}>{t.explore}</h1>

        <form action="/explore" method="GET" style={{ marginTop: "20px" }}>
          <input
            name="q"
            defaultValue={query}
            placeholder={t.search_placeholder}
            style={{
              width: "400px",
              padding: "14px",
              borderRadius: "12px",
            }}
          />

          <input type="hidden" name="tab" value={tab} />
        </form>
      </section>

      {query && (
        <section>
          {tab === "titles" && <HorizontalPosterRow items={titleResults} type="movie" />}
          {tab === "people" && <PeopleGrid items={peopleResults} />}
          {tab === "users" && <UsersGrid items={userResults} />}
        </section>
      )}

      <section>
        {sectionTitle(t.peeklists)}
        <HorizontalScroller>
          <PeeklistsRow items={peeklists} />
        </HorizontalScroller>
      </section>

      <section>
        {sectionTitle(t.trending_movies)}
        <HorizontalScroller>
          <HorizontalPosterRow items={trendingMovies} type="movie" />
        </HorizontalScroller>
      </section>

      <section>
        {sectionTitle(t.trending_tv)}
        <HorizontalScroller>
          <HorizontalPosterRow items={trendingTV} type="tv" />
        </HorizontalScroller>
      </section>

      <section>
        {sectionTitle(t.top_movies)}
        <HorizontalScroller>
          <HorizontalPosterRow items={topMovies} type="movie" />
        </HorizontalScroller>
      </section>

      <section>
        {sectionTitle(t.top_tv)}
        <HorizontalScroller>
          <HorizontalPosterRow items={topTV} type="tv" />
        </HorizontalScroller>
      </section>
    </div>
  );
}
