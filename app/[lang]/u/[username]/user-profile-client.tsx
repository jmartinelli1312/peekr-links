"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";
const POSTER = "https://image.tmdb.org/t/p/w342";

type Lang = "en" | "es" | "pt";
type TabKey = "watched" | "peeklists" | "likes" | "sneakpeeks";

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  language: string | null;
  is_private: boolean | null;
  display_name: string | null;
  is_creator: boolean | null;
  creator_status: string | null;
};

type WatchedRow = {
  tmdb_id: number;
  title: string | null;
  poster_path: string | null;
  media_type: string | null;
  rating: number | null;
  watched_at: string | null;
};

type LikedRow = {
  tmdb_id: number;
  media_type: string | null;
  poster_path: string | null;
  title_es: string | null;
  title_en: string | null;
  title_pt: string | null;
  vote_average: number | null;
};

type SneakPeekRow = {
  id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  image_urls: string[] | null;
  created_at: string;
};

type PeeklistRow = {
  id: string | number;
  title: string | null;
  visibility?: string | null;
  cover_url?: string | null;
  type?: "created" | "following";
};

type Texts = {
  userNotFound: string;
  watched: string;
  peeklists: string;
  likes: string;
  sneakpeeks: string;
  followers: string;
  following: string;
  follow: string;
  followingBtn: string;
  request: string;
  requested: string;
  privateAccountMsg: string;
  emptyWatched: string;
  emptyPeeklists: string;
  emptyLikes: string;
  emptySneakpeeks: string;
  creator: string;
  creatorBadge: string;
  settings: string;
  openInApp: string;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleHref(item: {
  tmdb_id: number;
  media_type?: string | null;
  title?: string | null;
  title_es?: string | null;
  title_en?: string | null;
  title_pt?: string | null;
}, lang: Lang) {
  const type = item.media_type === "tv" ? "tv" : "movie";
  const rawTitle =
    lang === "es"
      ? (item.title_es ?? item.title_en ?? item.title ?? "title")
      : lang === "pt"
      ? (item.title_pt ?? item.title_es ?? item.title_en ?? item.title ?? "title")
      : (item.title_en ?? item.title ?? "title");
  return `/title/${type}/${item.tmdb_id}-${slugify(rawTitle)}`;
}

function dedupeWatched(items: WatchedRow[]) {
  const seen = new Set<string>();
  const out: WatchedRow[] = [];
  for (const item of items) {
    const key = `${item.media_type || "movie"}-${item.tmdb_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupePeeklists(items: PeeklistRow[]) {
  const seen = new Set<string>();
  const out: PeeklistRow[] = [];
  for (const item of items) {
    const key = String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export default function UserProfileClient({
  username,
  lang,
  t,
}: {
  username: string;
  lang: Lang;
  t: Texts;
}) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [currentTab, setCurrentTab] = useState<TabKey>("watched");

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const [watched, setWatched] = useState<WatchedRow[]>([]);
  const [liked, setLiked] = useState<LikedRow[]>([]);
  const [sneakPeeks, setSneakPeeks] = useState<SneakPeekRow[]>([]);
  const [peeklistsCreated, setPeeklistsCreated] = useState<PeeklistRow[]>([]);
  const [peeklistsFollowing, setPeeklistsFollowing] = useState<PeeklistRow[]>([]);

  const isOwnProfile = meId != null && profile?.id === meId;
  const isCreator =
    profile?.is_creator === true || profile?.creator_status === "approved";

  async function loadFollowStats(uid: string) {
    const [followersRes, followingRes] = await Promise.all([
      supabase.from("follows").select("user_id", { count: "exact", head: true }).eq("follows_user_id", uid),
      supabase.from("follows").select("follows_user_id", { count: "exact", head: true }).eq("user_id", uid),
    ]);
    setFollowers(followersRes.count ?? 0);
    setFollowing(followingRes.count ?? 0);
  }

  async function loadAll() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const myId = user?.id ?? null;
      setMeId(myId);

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (!p) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(p as ProfileRow);
      setIsPrivate(p.is_private === true);

      const uid = p.id as string;

      // Parallel: follow stats + follow status + content
      const [, followRes, reqRes] = await Promise.all([
        loadFollowStats(uid),
        myId
          ? supabase.from("follows").select("user_id").eq("user_id", myId).eq("follows_user_id", uid)
          : Promise.resolve({ data: [] }),
        myId
          ? supabase.from("follow_requests").select("sender_id").eq("sender_id", myId).eq("receiver_id", uid)
          : Promise.resolve({ data: [] }),
      ]);

      const following_ = (followRes.data?.length ?? 0) > 0;
      const requested_ = (reqRes.data?.length ?? 0) > 0;
      setIsFollowing(following_);
      setIsRequested(requested_);

      const canSeeContent =
        !p.is_private || myId === uid || following_;

      // ── Watched ──
      if (canSeeContent) {
        const { data: watchedRows } = await supabase
          .from("user_title_activities")
          .select("tmdb_id,title,poster_path,media_type,rating,watched_at")
          .eq("user_id", uid)
          .order("watched_at", { ascending: false })
          .limit(120);
        setWatched(dedupeWatched((watchedRows as WatchedRow[] | null) ?? []));
      } else {
        setWatched([]);
      }

      // ── Likes (always visible — public info) ──
      const { data: likesRows } = await supabase
        .from("title_likes")
        .select("tmdb_id, media_type")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(80);

      if (likesRows && likesRows.length > 0) {
        const ids = likesRows.map((r: { tmdb_id: number }) => r.tmdb_id);
        const { data: cacheRows } = await supabase
          .from("titles_cache")
          .select("tmdb_id, poster_path, title_en, title_es, title_pt, vote_average")
          .in("tmdb_id", ids);

        const cacheMap = new Map<number, Record<string, unknown>>();
        for (const row of (cacheRows ?? [])) {
          cacheMap.set(row.tmdb_id as number, row);
        }

        setLiked(
          likesRows.map((like: { tmdb_id: number; media_type: string }) => {
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
          })
        );
      } else {
        setLiked([]);
      }

      // ── SneakPeeks (creators only) ──
      if (p.is_creator === true || p.creator_status === "approved") {
        const { data: spRows } = await supabase
          .from("sneak_peeks")
          .select("id, video_url, thumbnail_url, image_urls, created_at")
          .eq("creator_id", uid)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(24);
        setSneakPeeks((spRows as SneakPeekRow[] | null) ?? []);
      } else {
        setSneakPeeks([]);
      }

      // ── Peeklists ──
      const [{ data: createdRows }, { data: followingRows }] = await Promise.all([
        supabase.from("peeklists").select("id,title,visibility,cover_url").eq("created_by", uid),
        supabase.from("peeklist_follows").select("peeklists(id,title,visibility,cover_url)").eq("user_id", uid),
      ]);

      setPeeklistsCreated(
        ((createdRows as PeeklistRow[] | null) ?? []).map((item) => ({ ...item, type: "created" as const }))
      );
      setPeeklistsFollowing(
        ((followingRows as any[] | null) ?? [])
          .map((row) => row.peeklists)
          .filter(Boolean)
          .map((item: PeeklistRow) => ({ ...item, type: "following" as const }))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  async function handleToggleFollow() {
    if (processing || !profile) return;
    if (!meId) {
      window.location.href = "/login";
      return;
    }

    setProcessing(true);
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("user_id", meId).eq("follows_user_id", profile.id);
      } else if (isPrivate) {
        if (!isRequested) {
          await supabase.from("follow_requests").insert({ sender_id: meId, receiver_id: profile.id });
        }
      } else {
        await supabase.from("follows").insert({ user_id: meId, follows_user_id: profile.id });
      }
      await loadAll();
    } finally {
      setProcessing(false);
    }
  }

  const allPeeklists = useMemo(
    () => dedupePeeklists([...peeklistsCreated, ...peeklistsFollowing]),
    [peeklistsCreated, peeklistsFollowing]
  );

  const canViewContent = profile && (!isPrivate || isOwnProfile || isFollowing);

  // ── Tabs to show ──────────────────────────────────────────────────────────
  const tabs: { key: TabKey; label: string }[] = [
    { key: "watched", label: t.watched },
    { key: "likes", label: t.likes },
    { key: "peeklists", label: t.peeklists },
    ...(isCreator ? [{ key: "sneakpeeks" as TabKey, label: t.sneakpeeks }] : []),
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.7)" }}>Loading…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.8)", fontSize: 18 }}>
        {t.userNotFound}
      </div>
    );
  }

  // ── Sneak peek thumbnail helper ───────────────────────────────────────────
  function spThumb(sp: SneakPeekRow) {
    if (sp.thumbnail_url) return sp.thumbnail_url;
    if (sp.image_urls && sp.image_urls.length > 0) return sp.image_urls[0];
    return null;
  }

  return (
    <>
      <style>{`
        .user-page { min-height: 100vh; color: white; }

        /* ── Hero ── */
        .user-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 10px;
          padding-top: 10px;
        }

        .user-avatar-wrap {
          width: 104px;
          height: 104px;
          border-radius: 999px;
          padding: 3px;
          background: ${BRAND};
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .user-avatar, .user-avatar-fallback {
          width: 98px;
          height: 98px;
          border-radius: 999px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          display: block;
        }

        .user-name-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .user-username {
          color: ${BRAND};
          font-size: 26px;
          font-weight: 800;
          line-height: 1.05;
        }

        .creator-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(250,0,130,0.15);
          border: 1px solid rgba(250,0,130,0.35);
          color: ${BRAND};
          font-size: 11px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .user-display-name {
          color: rgba(255,255,255,0.78);
          font-size: 15px;
          font-weight: 600;
        }

        .user-bio {
          max-width: 720px;
          color: rgba(255,255,255,0.72);
          font-size: 15px;
          line-height: 1.7;
        }

        .user-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 6px;
        }

        .btn-primary, .btn-secondary {
          text-decoration: none;
          border-radius: 14px;
          padding: 13px 18px;
          font-weight: 800;
          font-size: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
        }
        .btn-primary { background: ${BRAND}; color: white; }
        .btn-secondary {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.10);
          color: white;
        }

        /* ── Stats ── */
        .stats-row {
          display: flex;
          justify-content: center;
          gap: 28px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .stat { text-align: center; }
        .stat-value { font-size: 20px; font-weight: 800; color: white; }
        .stat-label { font-size: 13px; color: rgba(255,255,255,0.66); margin-top: 2px; }

        /* ── Tabs ── */
        .tabs-row {
          margin-top: 30px;
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .tab-chip {
          border-radius: 999px;
          padding: 10px 14px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.06);
          color: white;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .tab-chip.active {
          color: ${BRAND};
          border-color: ${BRAND};
          background: rgba(250,0,130,0.12);
        }

        /* ── Content ── */
        .content-block { margin-top: 24px; }

        .private-state, .empty-state {
          min-height: 240px;
          display: grid;
          place-items: center;
          color: rgba(255,255,255,0.56);
          text-align: center;
          font-size: 15px;
        }

        /* ── Poster grid (Watched + Likes) ── */
        .poster-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .poster-card {
          display: block;
          text-decoration: none;
          color: white;
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          aspect-ratio: 2 / 3;
          background: rgba(255,255,255,0.06);
        }

        .poster-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .poster-rating {
          position: absolute;
          bottom: 6px;
          left: 6px;
          background: rgba(0,0,0,0.68);
          backdrop-filter: blur(4px);
          border-radius: 6px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 700;
          color: white;
          line-height: 1.4;
        }

        /* ── Peeklists ── */
        .peeklists-list { display: grid; gap: 12px; }

        .peeklist-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          text-decoration: none;
          color: white;
        }

        .peeklist-thumb, .peeklist-thumb-fallback {
          width: 74px;
          height: 54px;
          border-radius: 10px;
          object-fit: cover;
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
          flex-shrink: 0;
          display: block;
        }

        .peeklist-title { font-size: 16px; font-weight: 700; line-height: 1.35; }
        .peeklist-sub { margin-top: 4px; color: rgba(255,255,255,0.58); font-size: 13px; }

        /* ── SneakPeeks ── */
        .sp-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .sp-card {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          aspect-ratio: 9 / 16;
          background: rgba(255,255,255,0.06);
          display: block;
          text-decoration: none;
        }

        .sp-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .sp-play {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.28);
        }

        .sp-play-icon {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: white;
        }

        /* ── Responsive ── */
        @media (min-width: 600px) {
          .poster-grid, .sp-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
          }
        }

        @media (min-width: 900px) {
          .user-avatar-wrap { width: 118px; height: 118px; }
          .user-avatar, .user-avatar-fallback { width: 112px; height: 112px; }

          .poster-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 12px;
          }

          .sp-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 12px;
          }
        }
      `}</style>

      <div className="user-page">
        {/* ── Hero ── */}
        <section className="user-hero">
          <div className="user-avatar-wrap">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username || "user"} className="user-avatar" />
            ) : (
              <div className="user-avatar-fallback" />
            )}
          </div>

          <div className="user-name-row">
            <div className="user-username">@{profile.username}</div>
            {isCreator && (
              <span className="creator-badge">✦ {t.creatorBadge}</span>
            )}
          </div>

          {profile.display_name ? (
            <div className="user-display-name">{profile.display_name}</div>
          ) : null}

          {profile.bio ? <div className="user-bio">{profile.bio}</div> : null}

          <div className="user-actions">
            {!isOwnProfile ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleToggleFollow}
                disabled={processing || isRequested}
              >
                {isFollowing ? t.followingBtn : isRequested ? t.requested : isPrivate ? t.request : t.follow}
              </button>
            ) : (
              <Link href="/download-app" className="btn-secondary">
                {t.settings}
              </Link>
            )}

            <a
              href={`/go?u=${encodeURIComponent(profile.username ?? username)}`}
              className="btn-secondary"
            >
              {t.openInApp}
            </a>
          </div>

          <div className="stats-row">
            <div className="stat">
              <div className="stat-value">{followers}</div>
              <div className="stat-label">{t.followers}</div>
            </div>
            <div className="stat">
              <div className="stat-value">{following}</div>
              <div className="stat-label">{t.following}</div>
            </div>
            <div className="stat">
              <div className="stat-value">{watched.length}</div>
              <div className="stat-label">{t.watched}</div>
            </div>
          </div>
        </section>

        {/* ── Tabs ── */}
        <div className="tabs-row">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-chip ${currentTab === tab.key ? "active" : ""}`}
              onClick={() => setCurrentTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="content-block">

          {/* WATCHED */}
          {currentTab === "watched" && (
            !canViewContent ? (
              <div className="private-state">{t.privateAccountMsg}</div>
            ) : watched.length === 0 ? (
              <div className="empty-state">{t.emptyWatched}</div>
            ) : (
              <div className="poster-grid">
                {watched.map((item, i) => (
                  <Link
                    key={`${item.media_type}-${item.tmdb_id}-${i}`}
                    href={titleHref(item, lang)}
                    className="poster-card"
                  >
                    {item.poster_path ? (
                      <img
                        src={`${POSTER}${item.poster_path}`}
                        alt={item.title || ""}
                        className="poster-img"
                        loading="lazy"
                      />
                    ) : null}
                    {item.rating != null && item.rating > 0 && (
                      <div className="poster-rating">⭐ {item.rating.toFixed(1)}</div>
                    )}
                  </Link>
                ))}
              </div>
            )
          )}

          {/* LIKES */}
          {currentTab === "likes" && (
            liked.length === 0 ? (
              <div className="empty-state">{t.emptyLikes}</div>
            ) : (
              <div className="poster-grid">
                {liked.map((item, i) => (
                  <Link
                    key={`like-${item.media_type}-${item.tmdb_id}-${i}`}
                    href={titleHref(item, lang)}
                    className="poster-card"
                  >
                    {item.poster_path ? (
                      <img
                        src={`${POSTER}${item.poster_path}`}
                        alt={
                          lang === "es" ? (item.title_es ?? item.title_en ?? "") :
                          lang === "pt" ? (item.title_pt ?? item.title_es ?? item.title_en ?? "") :
                          (item.title_en ?? "")
                        }
                        className="poster-img"
                        loading="lazy"
                      />
                    ) : null}
                    {item.vote_average != null && item.vote_average > 0 && (
                      <div className="poster-rating">⭐ {item.vote_average.toFixed(1)}</div>
                    )}
                  </Link>
                ))}
              </div>
            )
          )}

          {/* PEEKLISTS */}
          {currentTab === "peeklists" && (
            allPeeklists.length === 0 ? (
              <div className="empty-state">{t.emptyPeeklists}</div>
            ) : (
              <div className="peeklists-list">
                {allPeeklists.map((pl) => (
                  <Link key={`${pl.type}-${pl.id}`} href={`/peeklist/${pl.id}`} className="peeklist-row">
                    {pl.cover_url ? (
                      <img src={pl.cover_url} alt={pl.title || "Peeklist"} className="peeklist-thumb" />
                    ) : (
                      <div className="peeklist-thumb-fallback" />
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="peeklist-title">{pl.title || "Untitled"}</div>
                      <div className="peeklist-sub">
                        {pl.type === "created" ? t.creator : t.following}
                      </div>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.55)" }}>›</div>
                  </Link>
                ))}
              </div>
            )
          )}

          {/* SNEAKPEEKS (creators only) */}
          {currentTab === "sneakpeeks" && (
            sneakPeeks.length === 0 ? (
              <div className="empty-state">{t.emptySneakpeeks}</div>
            ) : (
              <div className="sp-grid">
                {sneakPeeks.map((sp) => {
                  const thumb = spThumb(sp);
                  return (
                    <div key={sp.id} className="sp-card">
                      {thumb ? (
                        <img src={thumb} alt="SneakPeek" className="sp-thumb" loading="lazy" />
                      ) : (
                        <div className="sp-thumb" />
                      )}
                      {sp.video_url && (
                        <div className="sp-play">
                          <div className="sp-play-icon">▶</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

        </div>
      </div>
    </>
  );
}
