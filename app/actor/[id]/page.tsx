const TMDB = "https://api.themoviedb.org/3";

type PageProps = {
  params: {
    id: string;
  };
};

export default async function ActorPage({ params }: PageProps) {

  const id = params.id;

  const res = await fetch(
    `${TMDB}/person/${id}?api_key=${process.env.TMDB_API_KEY}`
  );

  const actor = await res.json();

  if (!actor) {
    return (
      <div style={{ padding: 40 }}>
        Actor not found
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>

      <h1>{actor.name}</h1>

      {actor.profile_path && (
        <img
          src={`https://image.tmdb.org/t/p/w500${actor.profile_path}`}
          style={{
            width: 200,
            borderRadius: 12,
            marginTop: 20
          }}
        />
      )}

      {actor.biography && (
        <p style={{ marginTop: 20, maxWidth: 700 }}>
          {actor.biography}
        </p>
      )}

    </div>
  );
}
