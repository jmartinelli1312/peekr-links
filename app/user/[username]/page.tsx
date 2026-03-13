import { supabase } from "@/lib/supabase";

type PageProps = {
  params: {
    username: string;
  };
};

export default async function UserPage({ params }: PageProps) {

  const username = params.username;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) {
    return (
      <div style={{ padding: 40 }}>
        User not found
      </div>
    );
  }

  const { data: watched } = await supabase
    .from("user_title_activities")
    .select("tmdb_id,title,poster_path,media_type,rating")
    .eq("user_id", profile.id);

  const { data: peeklists } = await supabase
    .from("peeklists")
    .select("*")
    .eq("created_by", profile.id);

  return (
    <div style={{ padding: 40 }}>

      <h1>@{profile.username}</h1>

      {profile.display_name && (
        <div style={{ marginTop: 4 }}>
          {profile.display_name}
        </div>
      )}

      {profile.bio && (
        <p style={{ marginTop: 10 }}>
          {profile.bio}
        </p>
      )}

      <h2 style={{ marginTop: 40 }}>Watched</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
          gap: 20,
          marginTop: 20
        }}
      >

        {watched?.map((w: any) => {

          const media = w.media_type === "tv" ? "tv" : "movie";

          return (
            <a
              key={w.tmdb_id}
              href={`/title/${media}/${w.tmdb_id}`}
              style={{ textDecoration: "none", color: "white" }}
            >

              {w.poster_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w342${w.poster_path}`}
                  style={{
                    width: "100%",
                    borderRadius: 12
                  }}
                />
              )}

              <div style={{ marginTop: 6 }}>
                {w.title}
              </div>

            </a>
          );
        })}

      </div>

      <h2 style={{ marginTop: 50 }}>Peeklists</h2>

      <div style={{ marginTop: 10 }}>

        {peeklists?.map((pl: any) => (
          <div key={pl.id} style={{ marginBottom: 12 }}>
            <a
              href={`/peeklist/${pl.id}`}
              style={{ color: "#FA0082", textDecoration: "none" }}
            >
              {pl.title}
            </a>
          </div>
        ))}

      </div>

    </div>
  );
}
