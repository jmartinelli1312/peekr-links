import { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import UserProfileClient from "./user-profile-client";

// Revalidate every 5 min — server-fetched, so we can keep it fresh
export const revalidate = 300;

const SITE = "https://www.peekr.app";

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

// ── helpers ──────────────────────────────────────────────────────────────────

function dedupeWatched<T extends { tmdb_id: number; media_type?: string | null }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.media_type || "movie"}-${item.tmdb_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; username: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, username } = await params;
  const lang = normalizeLang(rawLang);

  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,bio,avatar_url")
    .eq("username", username)
    .maybeSingle();

  const displayName = profile?.display_name || `@${username}`;
  const description = profile?.bio || `${displayName} on Peekr`;

  return {
    title: `${displayName} | Peekr`,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE}/${lang}/u/${username}` },
    openGraph: {
      title: `${displayName} | Peekr`,
      description,
      url: `${SITE}/${lang}/u/${username}`,
      siteName: "Peekr",
      type: "profile",
      images: profile?.avatar_url ? [{ url: profile.avatar_url }] : [],
    },
    twitter: { card: "summary", title: `${displayName} | Peekr`, description },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ lang: string; username: string }>;
}) {
  const { lang: rawLang, username } = await params;
  const lang = normalizeLang(rawLang);

  const t = {
    en: {
      userNotFound: "User not found",
      watched: "Watched",
      peeklists: "Peeklists",
      likes: "Likes",
      sneakpeeks: "SneakPeeks",
      followers: "Followers",
      following: "Following",
      follow: "Follow",
      followingBtn: "Following",
      request: "Request",
      requested: "Requested",
      privateAccountMsg: "This account is private.",
      emptyWatched: "No watched titles yet.",
      emptyPeeklists: "No Peeklists yet.",
      emptyLikes: "No liked titles yet.",
      emptySneakpeeks: "No SneakPeeks yet.",
      creator: "Creator",
      creatorBadge: "Creator",
      settings: "Settings",
      openInApp: "Open in app",
    },
    es: {
      userNotFound: "Usuario no encontrado",
      watched: "Vistos",
      peeklists: "Peeklists",
      likes: "Likes",
      sneakpeeks: "SneakPeeks",
      followers: "Seguidores",
      following: "Siguiendo",
      follow: "Seguir",
      followingBtn: "Siguiendo",
      request: "Solicitar",
      requested: "Solicitado",
      privateAccountMsg: "Esta cuenta es privada.",
      emptyWatched: "Todavía no hay títulos vistos.",
      emptyPeeklists: "Todavía no hay Peeklists.",
      emptyLikes: "Aún no hay títulos con me gusta.",
      emptySneakpeeks: "Todavía no hay SneakPeeks.",
      creator: "Creador",
      creatorBadge: "Creador",
      settings: "Settings",
      openInApp: "Abrir en app",
    },
    pt: {
      userNotFound: "Usuário não encontrado",
      watched: "Assistidos",
      peeklists: "Peeklists",
      likes: "Curtidas",
      sneakpeeks: "SneakPeeks",
      followers: "Seguidores",
      following: "Seguindo",
      follow: "Seguir",
      followingBtn: "Seguindo",
      request: "Solicitar",
      requested: "Solicitado",
      privateAccountMsg: "Esta conta é privada.",
      emptyWatched: "Ainda não há títulos assistidos.",
      emptyPeeklists: "Ainda não há Peeklists.",
      emptyLikes: "Ainda sem curtidas.",
      emptySneakpeeks: "Ainda não há SneakPeeks.",
      creator: "Criador",
      creatorBadge: "Criador",
      settings: "Settings",
      openInApp: "Abrir no app",
    },
  }[lang];

  // ── Server-side data fetch (bypasses RLS — visible to everyone) ──────────

  const supabase = getSupabaseAdmin();

  // 1. Profile
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select(
      "id, username, avatar_url, bio, language, is_private, display_name, is_creator, creator_status"
    )
    .eq("username", username)
    .maybeSingle();

  if (!profileRaw) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
          color: "rgba(255,255,255,0.8)",
          fontSize: 18,
        }}
      >
        {t.userNotFound}
      </div>
    );
  }

  const uid = profileRaw.id as string;
  const isPrivate = profileRaw.is_private === true;

  // 2. Follower / following counts
  const [followersRes, followingRes] = await Promise.all([
    supabase
      .from("follows")
      .select("user_id", { count: "exact", head: true })
      .eq("follows_user_id", uid),
    supabase
      .from("follows")
      .select("follows_user_id", { count: "exact", head: true })
      .eq("user_id", uid),
  ]);

  const followersCount = followersRes.count ?? 0;
  const followingCount = followingRes.count ?? 0;

  // 3. Content (only if profile is public — private profiles show nothing until followed)
  let watchedData: Array<{
    tmdb_id: number;
    title: string | null;
    poster_path: string | null;
    media_type: string | null;
    rating: number | null;
    watched_at: string | null;
  }> = [];

  let likedData: Array<{
    tmdb_id: number;
    media_type: string | null;
    poster_path: string | null;
    title_es: string | null;
    title_en: string | null;
    title_pt: string | null;
    vote_average: number | null;
  }> = [];

  let sneakPeeksData: Array<{
    id: string;
    video_url: string | null;
    thumbnail_url: string | null;
    image_urls: string[] | null;
    created_at: string;
  }> = [];

  let peeklistsCreatedData: Array<{
    id: string | number;
    title: string | null;
    visibility?: string | null;
    cover_url?: string | null;
    type: "created";
  }> = [];

  let peeklistsFollowingData: Array<{
    id: string | number;
    title: string | null;
    visibility?: string | null;
    cover_url?: string | null;
    type: "following";
  }> = [];

  // For private accounts the server returns empty — client will re-check after auth
  if (!isPrivate) {
    const [watchedRes, likesRes, spRes, createdRes, followingListRes] =
      await Promise.all([
        supabase
          .from("user_title_activities")
          .select("tmdb_id,title,poster_path,media_type,rating,watched_at")
          .eq("user_id", uid)
          .order("watched_at", { ascending: false })
          .limit(120),

        supabase
          .from("title_likes")
          .select("tmdb_id, media_type")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(80),

        profileRaw.is_creator === true || profileRaw.creator_status === "approved"
          ? supabase
              .from("sneak_peeks")
              .select("id, video_url, thumbnail_url, image_urls, created_at")
              .eq("creator_id", uid)
              .eq("is_published", true)
              .order("created_at", { ascending: false })
              .limit(24)
          : Promise.resolve({ data: [] }),

        supabase
          .from("peeklists")
          .select("id,title,visibility,cover_url")
          .eq("created_by", uid),

        supabase
          .from("peeklist_follows")
          .select("peeklists(id,title,visibility,cover_url)")
          .eq("user_id", uid),
      ]);

    watchedData = dedupeWatched(
      (watchedRes.data as typeof watchedData | null) ?? []
    );

    // Enrich likes with titles_cache
    const likesRows = (likesRes.data as Array<{ tmdb_id: number; media_type: string | null }> | null) ?? [];
    if (likesRows.length > 0) {
      const ids = likesRows.map((r) => r.tmdb_id);
      const { data: cacheRows } = await supabase
        .from("titles_cache")
        .select("tmdb_id, poster_path, title_en, title_es, title_pt, vote_average")
        .in("tmdb_id", ids);

      const cacheMap = new Map<number, Record<string, unknown>>();
      for (const row of cacheRows ?? []) {
        cacheMap.set(row.tmdb_id as number, row);
      }

      likedData = likesRows.map((like) => {
        const cache = cacheMap.get(like.tmdb_id);
        return {
          tmdb_id: like.tmdb_id,
          media_type: like.media_type,
          poster_path: (cache?.poster_path as string) ?? null,
          title_es: (cache?.title_es as string) ?? null,
          title_en: (cache?.title_en as string) ?? null,
          title_pt: (cache?.title_pt as string) ?? null,
          vote_average: (cache?.vote_average as number) ?? null,
        };
      });
    }

    sneakPeeksData = (spRes.data as typeof sneakPeeksData | null) ?? [];

    peeklistsCreatedData = (
      (createdRes.data as Array<{ id: string | number; title: string | null; visibility?: string | null; cover_url?: string | null }> | null) ?? []
    ).map((item) => ({ ...item, type: "created" as const }));

    peeklistsFollowingData = (
      (followingListRes.data as Array<{ peeklists: { id: string | number; title: string | null; visibility?: string | null; cover_url?: string | null } | null }> | null) ?? []
    )
      .map((row) => row.peeklists)
      .filter((pl): pl is NonNullable<typeof pl> => pl != null)
      .map((item) => ({ ...item, type: "following" as const }));
  }

  return (
    <UserProfileClient
      username={username}
      lang={lang}
      t={t}
      initialProfile={profileRaw as any}
      initialFollowers={followersCount}
      initialFollowing={followingCount}
      initialWatched={watchedData}
      initialLiked={likedData}
      initialSneakPeeks={sneakPeeksData}
      initialPeeklistsCreated={peeklistsCreatedData}
      initialPeeklistsFollowing={peeklistsFollowingData}
    />
  );
}
