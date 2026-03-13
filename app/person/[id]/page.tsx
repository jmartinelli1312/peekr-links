export const dynamic = "force-dynamic";

import Link from "next/link";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

type Params = {
  params: {
    id: string;
  };
};

async function fetchPerson(id: string) {
  const res = await fetch(
    `${TMDB_BASE}/person/${id}?api_key=${TMDB_KEY}`
  );

  if (!res.ok) return null;
  return res.json();
}

async function fetchCredits(id: string) {
  const res = await fetch(
    `${TMDB_BASE}/person/${id}/combined_credits?api_key=${TMDB_KEY}`
  );

  if (!res.ok) return null;
  return res.json();
}

export default async function PersonPage({ params }: Params) {
  const person = await fetchPerson(params.id);
  const credits = await fetchCredits(params.id);

  if (!person) return <div>Person not found</div>;

  const known = credits?.cast?.slice(0, 20) || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      
      {/* HEADER */}

      <section style={{ display: "flex", gap: "30px" }}>
        
        {person.profile_path && (
          <img
            src={`${IMG}${person.profile_path}`}
            style={{
              width: "220px",
              borderRadius: "16px",
            }}
          />
        )}

        <div>

          <h1 style={{ fontSize: "40px", margin: 0 }}>
            {person.name}
          </h1>

          {person.birthday && (
            <div style={{ opacity: 0.7, marginTop: "8px" }}>
              Born {person.birthday}
            </div>
          )}

          {person.biography && (
            <p
              style={{
                marginTop: "16px",
                maxWidth: "700px",
                lineHeight: 1.6,
                opacity: 0.85,
              }}
            >
              {person.biography.slice(0, 800)}...
            </p>
          )}
        </div>

      </section>

      {/* KNOWN FOR */}

      <section>

        <h2>Known For</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
            gap: "20px",
          }}
        >
          {known.map((m: any) => {

            const type = m.media_type === "tv" ? "tv" : "movie";

            return (
              <Link
                key={`${type}-${m.id}`}
                href={`/title/${type}/${m.id}`}
                style={{ textDecoration: "none", color: "#fff" }}
              >
                {m.poster_path && (
                  <img
                    src={`https://image.tmdb.org/t/p/w342${m.poster_path}`}
                    style={{
                      width: "100%",
                      borderRadius: "12px",
                    }}
                  />
                )}

                <div style={{ marginTop: "8px" }}>
                  {m.title || m.name}
                </div>
              </Link>
            );
          })}
        </div>

      </section>

    </div>
  );
}
