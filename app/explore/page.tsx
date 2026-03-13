export const dynamic = "force-dynamic";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

async function fetchTMDB(url: string) {
  const res = await fetch(url, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;

  return res.json();
}

async function getData() {
  const [
    trendingMovies,
    trendingTV,
    topMovies,
    topTV
  ] = await Promise.all([
    fetchTMDB(`${TMDB_BASE}/trending/movie/week?api_key=${TMDB_KEY}`),
    fetchTMDB(`${TMDB_BASE}/trending/tv/week?api_key=${TMDB_KEY}`),
    fetchTMDB(`${TMDB_BASE}/movie/top_rated?api_key=${TMDB_KEY}`),
    fetchTMDB(`${TMDB_BASE}/tv/top_rated?api_key=${TMDB_KEY}`)
  ]);

  return {
    trendingMovies: trendingMovies?.results || [],
    trendingTV: trendingTV?.results || [],
    topMovies: topMovies?.results || [],
    topTV: topTV?.results || [],
  };
}

function PosterGrid({
  items,
  type,
}: {
  items: any[];
  type: "movie" | "tv";
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
        gap: "18px",
      }}
    >
      {items.slice(0, 12).map((item) => {
        const poster = item.poster_path
          ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
          : null;

        return (
          <a
            key={item.id}
            href={`/title/${type}/${item.id}`}
            style={{
              textDecoration: "none",
              color: "white",
            }}
          >
            <div
              style={{
                transition: "transform 0.2s ease",
              }}
            >
              {poster ? (
                <img
                  src={poster}
                  style={{
                    width: "100%",
                    borderRadius: "12px",
                  }}
                />
              ) : (
                <div
                  style={{
                    background: "#222",
                    height: "225px",
                    borderRadius: "12px",
                  }}
                />
              )}
            </div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "14px",
                color: "#ddd",
              }}
            >
              {item.title || item.name}
            </div>
          </a>
        );
      })}
    </div>
  );
}

export default async function ExplorePage() {
  const { trendingMovies, trendingTV, topMovies, topTV } = await getData();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "60px" }}>
      
      {/* Trending Movies */}
      <section>
        <h2
          style={{
            fontSize: "28px",
            marginBottom: "20px",
            color: "#FA0082",
          }}
        >
          Trending Movies
        </h2>

        <PosterGrid items={trendingMovies} type="movie" />
      </section>

      {/* Trending TV */}
      <section>
        <h2
          style={{
            fontSize: "28px",
            marginBottom: "20px",
            color: "#FA0082",
          }}
        >
          Trending TV
        </h2>

        <PosterGrid items={trendingTV} type="tv" />
      </section>

      {/* Top Movies */}
      <section>
        <h2
          style={{
            fontSize: "28px",
            marginBottom: "20px",
            color: "#FA0082",
          }}
        >
          Top Rated Movies
        </h2>

        <PosterGrid items={topMovies} type="movie" />
      </section>

      {/* Top TV */}
      <section>
        <h2
          style={{
            fontSize: "28px",
            marginBottom: "20px",
            color: "#FA0082",
          }}
        >
          Top Rated TV
        </h2>

        <PosterGrid items={topTV} type="tv" />
      </section>
    </div>
  );
}
