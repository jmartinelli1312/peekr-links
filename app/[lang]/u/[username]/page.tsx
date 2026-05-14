import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import UserProfileClient from "./user-profile-client";

// Server-rendered on every request — profile data should be fresh
export const dynamic = "force-dynamic";

const SITE = "https://www.peekr.app";

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

// Anon Supabase client for server components.
// All content tables already have USING(true) policies, so no service role
// key is needed — the anon key is sufficient to read public profile data.
function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

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

  const supabase = getAnonClient();
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
      reviews: "Reviews",
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
      emptyReviews: "No reviews with rating yet.",
      emptySneakpeeks: "No SneakPeeks yet.",
      creator: "Creator",
      creatorBadge: "Creator",
      settings: "Settings",
      openInApp: "Open in app",
      seeMoreInApp: "See more reviews in the app",
    },
    es: {
      userNotFound: "Usuario no encontrado",
      watched: "Vistos",
      peeklists: "Peeklists",
      likes: "Likes",
      reviews: "Reseñas",
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
      emptyReviews: "Aún no hay reseñas con calificación.",
      emptySneakpeeks: "Todavía no hay SneakPeeks.",
      creator: "Creador",
      creatorBadge: "Creador",
      settings: "Settings",
      openInApp: "Abrir en app",
      seeMoreInApp: "Ver más reseñas en la app",
    },
    pt: {
      userNotFound: "Usuário não encontrado",
      watched: "Assistidos",
      peeklists: "Peeklists",
      likes: "Curtidas",
      reviews: "Resenhas",
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
      emptyReviews: "Ainda sem resenhas com avaliação.",
      emptySneakpeeks: "Ainda não há SneakPeeks.",
      creator: "Criador",
      creatorBadge: "Criador",
      settings: "Settings",
      openInApp: "Abrir no app",
      seeMoreInApp: "Ver mais resenhas no app",
    },
  }[lang];

  // ── Server-side data fetch (anon key — works with existing public RLS policies)

  const supabase = getAnonClient();

  // 1. Profile — profiles has USING(true) policies, anon can read
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select(
      "id, username, avatar_url, bio, language, is_private, display_name, creator_status"
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

  // 2. Follow counts — follows now has USING(true) policy for anon reads
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

  // 3. Content — only fetch for public profiles.
  //    Private profiles: client re-fetches after auth check confirms follower status.
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

  // Reviews = comments + rating on same title (matches Flutter behavior).
  let reviewsData: Array<{
    tmdb_id: number;
    media_type: string;
    title: string;
    poster_path: string | null;
    rating: number;
    comment: string;
    created_at: string;
  }> = [];

  if (!isPrivate) {
    const [watchedRes, likesRes, spRes, createdRes, followingListRes] =
      await Promise.all([
        // user_title_activities: USING(true)
        supabase
          .from("user_title_activities")
          .select("tmdb_id,title,poster_path,media_type,rating,watched_at")
          .eq("user_id", uid)
          .order("watched_at", { ascending: false })
          .limit(120),

        // title_likes: USING(true)
        supabase
          .from("title_likes")
          .select("tmdb_id, media_type")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(80),

        // sneak_peeks: USING(is_published = true OR creator = me)
        profileRaw.creator_status === "approved"
          ? supabase
              .from("sneak_peeks")
              .select("id, video_url, thumbnail_url, image_urls, created_at")
              .eq("creator_id", uid)
              .eq("is_published", true)
              .order("created_at", { ascending: false })
              .limit(24)
          : Promise.resolve({ data: [] }),

        // peeklists: USING(true)
        supabase
          .from("peeklists")
          .select("id,title,visibility,cover_url")
          .eq("created_by", uid),

        // peeklist_follows: USING(true)
        supabase
          .from("peeklist_follows")
          .select("peeklists(id,title,visibility,cover_url)")
          .eq("user_id", uid),
      ]);

    watchedData = dedupeWatched(
      (watchedRes.data as typeof watchedData | null) ?? []
    );

    // Enrich likes with titles_cache — titles_cache: USING(true)
    const likesRows =
      (likesRes.data as Array<{ tmdb_id: number; media_type: string | null }> | null) ?? [];
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
      (createdRes.data as Array<{
        id: string | number;
        title: string | null;
        visibility?: string | null;
        cover_url?: string | null;
      }> | null) ?? []
    ).map((item) => ({ ...item, type: "created" as const }));

    peeklistsFollowingData = (
      (followingListRes.data as Array<{
        peeklists: {
          id: string | number;
          title: string | null;
          visibility?: string | null;
          cover_url?: string | null;
        } | null;
      }> | null) ?? []
    )
      .map((row) => row.peeklists)
      .filter((pl): pl is NonNullable<typeof pl> => pl != null)
      .map((item) => ({ ...item, type: "following" as const }));

    // Reviews: comments by this user that have a rating on the same title.
    // Matches Flutter `fetchUserReviews` behavior.
    const { data: rawComments } = await supabase
      .from("comments")
      .select("tmdb_id, comment, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    const comments =
      (rawComments as Array<{
        tmdb_id: number;
        comment: string;
        created_at: string;
      }> | null) ?? [];

    if (comments.length > 0) {
      const commentedTmdbIds = Array.from(
        new Set(comments.map((c) => c.tmdb_id))
      );

      // Fetch ratings for those titles
      const { data: ratingsRaw } = await supabase
        .from("user_title_activities")
        .select("tmdb_id, media_type, rating, title, poster_path")
        .eq("user_id", uid)
        .in("tmdb_id", commentedTmdbIds)
        .not("rating", "is", null);

      const ratingsByTmdb = new Map<
        number,
        {
          media_type: string;
          rating: number;
          title: string | null;
          poster_path: string | null;
        }
      >();

      for (const r of (ratingsRaw as Array<{
        tmdb_id: number;
        media_type: string | null;
        rating: number | null;
        title: string | null;
        poster_path: string | null;
      }> | null) ?? []) {
        const rating = typeof r.rating === "number" ? r.rating : 0;
        if (rating <= 0) continue;
        const existing = ratingsByTmdb.get(r.tmdb_id);
        if (!existing || rating > existing.rating) {
          ratingsByTmdb.set(r.tmdb_id, {
            media_type: r.media_type === "tv" ? "tv" : "movie",
            rating,
            title: r.title,
            poster_path: r.poster_path,
          });
        }
      }

      // Fetch cache for fallback titles/posters
      const ratedIds = Array.from(ratingsByTmdb.keys());
      const cacheByTmdb = new Map<
        number,
        { poster_path: string | null; title: string | null }
      >();

      if (ratedIds.length > 0) {
        const { data: cacheRows } = await supabase
          .from("titles_cache")
          .select("tmdb_id, poster_path, title_es, title_en, title_pt")
          .in("tmdb_id", ratedIds);

        for (const c of (cacheRows as Array<{
          tmdb_id: number;
          poster_path: string | null;
          title_es: string | null;
          title_en: string | null;
          title_pt: string | null;
        }> | null) ?? []) {
          const title =
            lang === "es"
              ? c.title_es || c.title_en || c.title_pt
              : lang === "pt"
                ? c.title_pt || c.title_en || c.title_es
                : c.title_en || c.title_es || c.title_pt;
          cacheByTmdb.set(c.tmdb_id, {
            poster_path: c.poster_path,
            title: title ?? null,
          });
        }
      }

      // Merge — only the most recent comment per title that has a rating
      const seen = new Set<number>();
      for (const c of comments) {
        if (seen.has(c.tmdb_id)) continue;
        const rating = ratingsByTmdb.get(c.tmdb_id);
        if (!rating) continue;
        seen.add(c.tmdb_id);
        const cache = cacheByTmdb.get(c.tmdb_id);
        reviewsData.push({
          tmdb_id: c.tmdb_id,
          media_type: rating.media_type,
          title: rating.title || cache?.title || "",
          poster_path: rating.poster_path || cache?.poster_path || null,
          rating: rating.rating,
          comment: c.comment,
          created_at: c.created_at,
        });
      }
    }
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
      initialReviews={reviewsData}
    />
  );
}
