import { supabase } from "@/lib/supabase";

type PageProps = {
  params: {
    id: string;
  };
};

export default async function PeeklistPage({ params }: PageProps) {

  const id = params.id;

  const { data: peeklist } = await supabase
    .from("peeklists")
    .select("*")
    .eq("id", id)
    .single();

  if (!peeklist) {
    return (
      <div style={{ padding: 40 }}>
        Peeklist not found
      </div>
    );
  }

  const { data: titles } = await supabase
    .from("peeklist_titles")
    .select("*")
    .eq("peeklist_id", id);

  return (
    <div style={{ padding: 40 }}>

      <h1>{peeklist.title}</h1>

      {peeklist.description && (
        <p style={{ marginTop: 10 }}>
          {peeklist.description}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
          gap: 20,
          marginTop: 30
        }}
      >

        {titles?.map((t: any) => {

          const media = t.media_type === "tv" ? "tv" : "movie";

          return (
            <a
              key={t.tmdb_id}
              href={`/title/${media}/${t.tmdb_id}`}
              style={{ textDecoration: "none", color: "white" }}
            >

              {t.poster_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w342${t.poster_path}`}
                  style={{
                    width: "100%",
                    borderRadius: 12
                  }}
                />
              )}

              <div style={{ marginTop: 8 }}>
                {t.title}
              </div>

            </a>
          );
        })}

      </div>

    </div>
  );
}
