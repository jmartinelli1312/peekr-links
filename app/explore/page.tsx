export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { translations, getLang } from "@/lib/i18n";
import HorizontalScroller from "@/components/HorizontalScroller";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const BRAND = "#FA0082";

type SearchParams = {
  q?: string;
  tab?: string;
};

const lang = getLang();
const t = translations[lang as "en" | "es" | "pt"];

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
    const { data } = await supabase.from("peeklists").select("*").limit(12);
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
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${q}%`)
      .limit(12);

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
    <>
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
              transition: "transform 0.2s ease",
            }}
          >
            <div
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.transform = "scale(1.08)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.transform = "scale(1)")
              }
            >
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
                  fontWeight: 500,
                }}
              >
                {item.title || item.name}
              </div>
            </div>
          </Link>
        );
      })}
    </>
  );
}

function PeeklistsRow({ items }: { items: any[] }) {
  return (
    <>
      {items.map((list) => {
        const title =
          list.title || list.name || list.peeklist_name || "Peeklist";

        const cover =
          list.cover_url ||
          list.cover_image_url ||
          list.image_url ||
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
            </div>
          </div>
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
        <h1
          style={{
            fontSize: "42px",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          {t.explore}
        </h1>

        <form
          action="/explore"
          method="GET"
          style={{
            marginTop: "22px",
            display: "flex",
            gap: "10px",
          }}
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder={t.search_placeholder}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#fff",
              borderRadius: "14px",
              padding: "14px 16px",
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
              fontWeight: 700,
            }}
          >
            Search
          </button>
        </form>

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <SearchPill
            href={`/explore?q=${encodeURIComponent(query)}&tab=titles`}
            active={tab === "titles"}
            label={t.titles}
          />
          <SearchPill
            href={`/explore?q=${encodeURIComponent(query)}&tab=people`}
            active={tab === "people"}
            label={t.people}
          />
          <SearchPill
            href={`/explore?q=${encodeURIComponent(query)}&tab=users`}
            active={tab === "users"}
            label={t.users}
          />
        </div>
      </section>

      {peeklists.length > 0 && (
        <section>
          {sectionTitle(t.peeklists)}
          <HorizontalScroller>
            <PeeklistsRow items={peeklists} />
          </HorizontalScroller>
        </section>
      )}

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
