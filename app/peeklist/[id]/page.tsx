export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w342";
const BRAND = "#FA0082";

type Params = {
  params: {
    id: string;
  };
};

async function getPeeklist(id: string) {
  const { data } = await supabase
    .from("peeklists")
    .select("*")
    .eq("id", id)
    .single();

  return data;
}

async function getPeeklistTitles(id: string) {
  const { data } = await supabase
    .from("peeklist_titles")
    .select("*")
    .eq("peeklist_id", id);

  return data || [];
}

function TitleGrid({ titles }: { titles: any[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
        gap: "20px",
      }}
    >
      {titles.map((t) => {
        const poster = t.poster_path
          ? `${TMDB_IMAGE}${t.poster_path}`
          : null;

        const type = t.media_type === "tv" ? "tv" : "movie";

        return (
          <Link
            key={`${type}-${t.tmdb_id}`}
            href={`/title/${type}/${t.tmdb_id}`}
            style={{
              textDecoration: "none",
              color: "#fff",
            }}
          >
            {poster ? (
              <img
                src={poster}
                alt={t.title}
                style={{
                  width: "100%",
                  aspectRatio: "2 / 3",
                  objectFit: "cover",
                  borderRadius: "14px",
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
                fontWeight: 600,
              }}
            >
              {t.title}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default async function PeeklistPage({ params }: Params) {
  const peeklist = await getPeeklist(params.id);
  const titles = await getPeeklistTitles(params.id);

  if (!peeklist) {
    return <div>Peeklist not found</div>;
  }

  const cover =
    peeklist.cover_url ||
    peeklist.cover_image_url ||
    null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "40px",
      }}
    >
      {/* HEADER */}
      <section
        style={{
          display: "flex",
          gap: "30px",
          alignItems: "center",
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt={peeklist.title}
            style={{
              width: "200px",
              borderRadius: "16px",
            }}
          />
        ) : (
          <div
            style={{
              width: "200px",
              height: "200px",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg,#FA0082,rgba(255,255,255,0.1))",
            }}
          />
        )}

        <div>
          <h1
            style={{
              fontSize: "40px",
              margin: 0,
              fontWeight: 900,
            }}
          >
            {peeklist.title || "Peeklist"}
          </h1>

          {peeklist.description && (
            <p
              style={{
                marginTop: "12px",
                maxWidth: "600px",
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.6,
              }}
            >
              {peeklist.description}
            </p>
          )}

          <div
            style={{
              marginTop: "14px",
              color: BRAND,
              fontWeight: 700,
            }}
          >
            {titles.length} titles
          </div>
        </div>
      </section>

      {/* TITLES */}
      <section>
        <TitleGrid titles={titles} />
      </section>
    </div>
  );
}
