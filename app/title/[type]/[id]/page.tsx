export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/original";
const POSTER = "https://image.tmdb.org/t/p/w342";

async function getTitle(type: string, id: string) {
  const res = await fetch(
    `${TMDB}/${type}/${id}?api_key=${TMDB_KEY}&append_to_response=credits,videos`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) return null;
  return res.json();
}

export default async function TitlePage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {

  const { type, id } = await params

  const data = await getTitle(type, id);

  if (!data) {
    return (
      <div style={{ padding: 40, color: "white" }}>
        Error loading TMDB data<br />
        type: {type} id: {id}
      </div>
    );
  }

  const title = data.title || data.name;
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  const backdrop = data.backdrop_path;
  const poster = data.poster_path;

  const cast = data.credits?.cast?.slice(0, 12) || [];

  const trailer =
    data.videos?.results?.find((v: any) => v.type === "Trailer") || null;

  return (
    <div style={{ background: "#0B0B0F", minHeight: "100vh", color: "white" }}>
      
      {/* HERO BACKDROP */}

      {backdrop && (
        <div
          style={{
            position: "relative",
            height: 420,
            overflow: "hidden",
          }}
        >
          <Image
            src={`${IMG}${backdrop}`}
            alt={title}
            fill
            style={{ objectFit: "cover", opacity: 0.35 }}
          />
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "auto", padding: 30 }}>

        {/* HEADER */}

        <div style={{ display: "flex", gap: 30 }}>

          {poster && (
            <Image
              src={`${POSTER}${poster}`}
              alt={title}
              width={220}
              height={330}
              style={{ borderRadius: 10 }}
            />
          )}

          <div>

            <h1 style={{ fontSize: 36, fontWeight: 700 }}>
              {title} {year && <span style={{ opacity: 0.6 }}>({year})</span>}
            </h1>

            <div style={{ marginTop: 10, opacity: 0.7 }}>
              {data.runtime && <>⏱ {data.runtime} min</>}
            </div>

            <div style={{ marginTop: 10 }}>
              {data.genres?.map((g: any) => (
                <span
                  key={g.id}
                  style={{
                    marginRight: 10,
                    padding: "4px 10px",
                    background: "#1c1c24",
                    borderRadius: 20,
                    fontSize: 12,
                  }}
                >
                  {g.name}
                </span>
              ))}
            </div>

            {trailer && (
              <div style={{ marginTop: 20 }}>
                <Link
                  href={`https://youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  style={{
                    background: "#FA0082",
                    padding: "10px 18px",
                    borderRadius: 8,
                  }}
                >
                  ▶ Watch Trailer
                </Link>
              </div>
            )}

          </div>
        </div>

        {/* OVERVIEW */}

        {data.overview && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 22 }}>Overview</h2>
            <p style={{ marginTop: 10, opacity: 0.8 }}>{data.overview}</p>
          </div>
        )}

        {/* CAST */}

        {cast.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 22 }}>Cast</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,120px)",
                gap: 20,
                marginTop: 20,
              }}
            >
              {cast.map((c: any) => (
                <div key={c.id} style={{ textAlign: "center" }}>
                  {c.profile_path && (
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${c.profile_path}`}
                      alt={c.name}
                      width={120}
                      height={160}
                      style={{ borderRadius: 8 }}
                    />
                  )}
                  <div style={{ marginTop: 6, fontSize: 13 }}>{c.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
