export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const BRAND = "#FA0082";

type Params = {
  params: {
    username: string;
  };
};

async function getProfile(username: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  return data;
}

async function getFollowStats(userId: string) {
  const followers = await supabase
    .from("follows")
    .select("*")
    .eq("follows_user_id", userId);

  const following = await supabase
    .from("follows")
    .select("*")
    .eq("user_id", userId);

  return {
    followers: followers.data?.length || 0,
    following: following.data?.length || 0,
  };
}

async function getWatched(userId: string) {
  const { data } = await supabase
    .from("user_title_activities")
    .select("tmdb_id,title,poster_path,media_type,rating")
    .eq("user_id", userId)
    .order("watched_at", { ascending: false });

  if (!data) return [];

  const unique: Record<number, any> = {};

  for (const item of data) {
    const id = Number(item.tmdb_id);
    unique[id] = item;
  }

  return Object.values(unique);
}

async function getPeeklists(userId: string) {
  const { data } = await supabase
    .from("peeklists")
    .select("id,title,cover_url")
    .eq("created_by", userId);

  return data || [];
}

function PosterGrid({ items }: { items: any[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
        gap: "12px",
      }}
    >
      {items.map((m) => {
        const type = m.media_type === "tv" ? "tv" : "movie";

        return (
          <Link
            key={`${type}-${m.tmdb_id}`}
            href={`/title/${type}/${m.tmdb_id}`}
            style={{ textDecoration: "none", color: "#fff" }}
          >
            {m.poster_path && (
              <img
                src={`${TMDB_IMG}${m.poster_path}`}
                style={{
                  width: "100%",
                  borderRadius: "10px",
                }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}

function PeeklistsList({ items }: { items: any[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {items.map((pl) => (
        <Link
          key={pl.id}
          href={`/peeklist/${pl.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "14px",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "12px",
            textDecoration: "none",
            color: "#fff",
          }}
        >
          {pl.cover_url ? (
            <img
              src={pl.cover_url}
              style={{
                width: "60px",
                height: "60px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />
          ) : (
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "8px",
                background: BRAND,
              }}
            />
          )}

          <div style={{ fontWeight: 600 }}>{pl.title}</div>
        </Link>
      ))}
    </div>
  );
}

export default async function UserPage({ params }: Params) {
  const profile = await getProfile(params.username);

  if (!profile) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        User not found
      </div>
    );
  }

  const stats = await getFollowStats(profile.id);
  const watched = await getWatched(profile.id);
  const peeklists = await getPeeklists(profile.id);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "12px",
        }}
      >
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            style={{
              width: "90px",
              height: "90px",
              borderRadius: "50%",
            }}
          />
        )}

        <h1 style={{ margin: 0, color: BRAND }}>
          @{profile.username}
        </h1>

        {profile.display_name && (
          <div style={{ opacity: 0.7 }}>
            {profile.display_name}
          </div>
        )}

        {profile.bio && (
          <p
            style={{
              maxWidth: "500px",
              opacity: 0.8,
            }}
          >
            {profile.bio}
          </p>
        )}

        <button
          style={{
            marginTop: "10px",
            background: BRAND,
            border: "none",
            padding: "10px 20px",
            borderRadius: "10px",
            fontWeight: 700,
          }}
        >
          Follow
        </button>

        <div
          style={{
            display: "flex",
            gap: "30px",
            marginTop: "10px",
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>
              {stats.followers}
            </div>
            <div style={{ opacity: 0.6 }}>
              Followers
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700 }}>
              {stats.following}
            </div>
            <div style={{ opacity: 0.6 }}>
              Following
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700 }}>
              {watched.length}
            </div>
            <div style={{ opacity: 0.6 }}>
              Watched
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ color: BRAND }}>
          Watched
        </h2>

        <PosterGrid items={watched} />
      </section>

      <section>
        <h2 style={{ color: BRAND }}>
          Peeklists
        </h2>

        <PeeklistsList items={peeklists} />
      </section>
    </div>
  );
}
