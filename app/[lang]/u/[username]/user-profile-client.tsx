"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";
const POSTER = "https://image.tmdb.org/t/p/w342";

type Lang = "en" | "es" | "pt";
type TabKey = "watched" | "peeklists";

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  language: string | null;
  is_private: boolean | null;
  display_name: string | null;
};

type WatchedRow = {
  tmdb_id: number;
  title: string | null;
  poster_path: string | null;
  media_type: string | null;
  rating: number | null;
  watched_at: string | null;
};

type PeeklistRow = {
  id: string | number;
  title: string | null;
  visibility?: string | null;
  cover_url?: string | null;
  type?: "created" | "following";
};

type FollowRow = {
  id?: string;
};

type Texts = {
  userNotFound: string;
  watched: string;
  peeklists: string;
  followers: string;
  following: string;
  follow: string;
  followingBtn: string;
  request: string;
  requested: string;
  privateAccountMsg: string;
  emptyWatched: string;
  emptyPeeklists: string;
  creator: string;
  settings: string;
  openInApp: string;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleHref(item: {
  tmdb_id: number;
  media_type?: string | null;
  title?: string | null;
}) {
  const type = item.media_type === "tv" ? "tv" : "movie";
  const rawTitle = item.title || "title";
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
  const [peeklistsCreated, setPeeklistsCreated] = useState<PeeklistRow[]>([]);
  const [peeklistsFollowing, setPeeklistsFollowing] = useState<PeeklistRow[]>([]);

  const isOwnProfile = meId != null && profile?.id === meId;

  async function loadFollowStats(uid: string) {
    const [followersRes, followingRes] = await Promise.all([
      supabase.from("follows").select("user_id").eq("follows_user_id", uid),
      supabase.from("follows").select("follows_user_id").eq("user_id", uid),
    ]);

    setFollowers(followersRes.data?.length ?? 0);
    setFollowing(followingRes.data?.length ?? 0);
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

      await loadFollowStats(uid);

      if (myId) {
        const [followRes, reqRes] = await Promise.all([
          supabase
            .from("follows")
            .select("user_id")
            .eq("user_id", myId)
            .eq("follows_user_id", uid),
          supabase
            .from("follow_requests")
            .select("sender_id")
            .eq("sender_id", myId)
            .eq("receiver_id", uid),
        ]);

        setIsFollowing((followRes.data?.length ?? 0) > 0);
        setIsRequested((reqRes.data?.length ?? 0) > 0);
      } else {
        setIsFollowing(false);
        setIsRequested(false);
      }

      const canSeePrivateContent = !p.is_private || myId === uid || (myId && isFollowing);

      if (!p.is_private || myId === uid || (myId && (await supabase
        .from("follows")
        .select("user_id")
        .eq("user_id", myId)
        .eq("follows_user_id", uid)).data?.length)) {
        const { data: watchedRows } = await supabase
          .from("user_title_activities")
          .select("tmdb_id,title,poster_path,media_type,rating,watched_at")
          .eq("user_id", uid)
          .order("watched_at", { ascending: false });

        setWatched(dedupeWatched((watchedRows as WatchedRow[] | null) ?? []));
      } else {
        setWatched([]);
      }

      const { data: createdRows } = await supabase
        .from("peeklists")
        .select("id,title,visibility,cover_url")
        .eq("created_by", uid);

      setPeeklistsCreated(
        (((createdRows as PeeklistRow[] | null) ?? []).map((item) => ({
          ...item,
          type: "created" as const,
        })))
      );

      const { data: followingRows } = await supabase
        .from("peeklist_follows")
        .select("peeklists(id,title,visibility,cover_url)")
        .eq("user_id", uid);

      setPeeklistsFollowing(
        (((followingRows as any[] | null) ?? [])
          .map((row) => row.peeklists)
          .filter(Boolean)
          .map((item) => ({
            ...(item as PeeklistRow),
            type: "following" as const,
          })))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
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
        await supabase
          .from("follows")
          .delete()
          .eq("user_id", meId)
          .eq("follows_user_id", profile.id);
      } else if (isPrivate) {
        if (!isRequested) {
          await supabase.from("follow_requests").insert({
            sender_id: meId,
            receiver_id: profile.id,
          });
        }
      } else {
        await supabase.from("follows").insert({
          user_id: meId,
          follows_user_id: profile.id,
        });
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

  const canViewContent =
    profile && (!isPrivate || isOwnProfile || isFollowing);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.7)" }}>Loading...</div>
      </div>
    );
  }

  if (!profile) {
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

  return (
    <>
      <style>{`
        .user-page {
          min-height: 100vh;
          color: white;
        }

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

        .user-avatar,
        .user-avatar-fallback {
          width: 98px;
          height: 98px;
          border-radius: 999px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          display: block;
        }

        .user-username {
          color: ${BRAND};
          font-size: 26px;
          font-weight: 800;
          line-height: 1.05;
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

        .btn-primary,
        .btn-secondary {
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

        .btn-primary {
          background: ${BRAND};
          color: white;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.10);
          color: white;
        }

        .stats-row {
          display: flex;
          justify-content: center;
          gap: 28px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 800;
          color: white;
        }

        .stat-label {
          font-size: 13px;
          color: rgba(255,255,255,0.66);
          margin-top: 2px;
        }

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
        }

        .tab-chip.active {
          color: ${BRAND};
          border-color: ${BRAND};
          background: rgba(250,0,130,0.12);
        }

        .content-block {
          margin-top: 24px;
        }

        .private-state,
        .empty-state {
          min-height: 240px;
          display: grid;
          place-items: center;
          color: rgba(255,255,255,0.56);
          text-align: center;
        }

        .watched-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .watched-card {
          display: block;
          text-decoration: none;
          color: white;
        }

        .watched-poster,
        .watched-fallback {
          width: 100%;
          aspect-ratio: 2 / 3;
          border-radius: 12px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          display: block;
        }

        .peeklists-list {
          display: grid;
          gap: 12px;
        }

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

        .peeklist-thumb,
        .peeklist-thumb-fallback {
          width: 74px;
          height: 54px;
          border-radius: 10px;
          object-fit: cover;
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
          flex-shrink: 0;
          display: block;
        }

        .peeklist-title {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.35;
        }

        .peeklist-sub {
          margin-top: 4px;
          color: rgba(255,255,255,0.58);
          font-size: 13px;
        }

        @media (min-width: 900px) {
          .user-avatar-wrap {
            width: 118px;
            height: 118px;
          }

          .user-avatar,
          .user-avatar-fallback {
            width: 112px;
            height: 112px;
          }

          .watched-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 14px;
          }
        }
      `}</style>

      <div className="user-page">
        <section className="user-hero">
          <div className="user-avatar-wrap">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username || "user"}
                className="user-avatar"
              />
            ) : (
              <div className="user-avatar-fallback" />
            )}
          </div>

          <div className="user-username">@{profile.username}</div>

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
                {isFollowing
                  ? t.followingBtn
                  : isRequested
                  ? t.requested
                  : isPrivate
                  ? t.request
                  : t.follow}
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

        <div className="tabs-row">
          <button
            type="button"
            className={`tab-chip ${currentTab === "watched" ? "active" : ""}`}
            onClick={() => setCurrentTab("watched")}
          >
            {t.watched}
          </button>

          <button
            type="button"
            className={`tab-chip ${currentTab === "peeklists" ? "active" : ""}`}
            onClick={() => setCurrentTab("peeklists")}
          >
            {t.peeklists}
          </button>
        </div>

        <div className="content-block">
          {!canViewContent ? (
            <div className="private-state">{t.privateAccountMsg}</div>
          ) : currentTab === "watched" ? (
            watched.length === 0 ? (
              <div className="empty-state">{t.emptyWatched}</div>
            ) : (
              <div className="watched-grid">
                {watched.map((item, i) => (
                  <Link
                    key={`${item.media_type}-${item.tmdb_id}-${i}`}
                    href={titleHref(item)}
                    className="watched-card"
                  >
                    {item.poster_path ? (
                      <img
                        src={`${POSTER}${item.poster_path}`}
                        alt={item.title || "title"}
                        className="watched-poster"
                      />
                    ) : (
                      <div className="watched-fallback" />
                    )}
                  </Link>
                ))}
              </div>
            )
          ) : allPeeklists.length === 0 ? (
            <div className="empty-state">{t.emptyPeeklists}</div>
          ) : (
            <div className="peeklists-list">
              {allPeeklists.map((pl) => (
                <Link
                  key={`${pl.type}-${pl.id}`}
                  href={`/peeklist/${pl.id}`}
                  className="peeklist-row"
                >
                  {pl.cover_url ? (
                    <img
                      src={pl.cover_url}
                      alt={pl.title || "Peeklist"}
                      className="peeklist-thumb"
                    />
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
          )}
        </div>
      </div>
    </>
  );
}
