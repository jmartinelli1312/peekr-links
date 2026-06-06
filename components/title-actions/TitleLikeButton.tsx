"use client";

// Heart button next to the title — mirrors the `title_likes` flow used by
// detail_screen.dart on Flutter. Optimistic UI: toggle the heart first,
// upsert/delete in Supabase, revert on error so the count stays in sync.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizeLang } from "./i18n";

type Props = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  lang: string;
};

export default function TitleLikeButton({ tmdbId, mediaType, lang }: Props) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);

  const labels = (() => {
    const l = normalizeLang(lang);
    if (l === "pt") return { likeAria: "Curtir", count: (n: number) => `${n} curtidas` };
    if (l === "en") return { likeAria: "Like", count: (n: number) => `${n} likes` };
    return { likeAria: "Me gusta", count: (n: number) => `${n} me gusta` };
  })();

  const fetchState = useCallback(async () => {
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp.user?.id ?? null;
    setViewerId(uid);

    // Total likes on this title (any user).
    const { count: total } = await supabase
      .from("title_likes")
      .select("user_id", { count: "exact", head: true })
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType);
    setCount(total ?? 0);

    // Viewer's own like.
    if (uid) {
      const { data } = await supabase
        .from("title_likes")
        .select("user_id")
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType)
        .eq("user_id", uid)
        .maybeSingle();
      setLiked(Boolean(data));
    } else {
      setLiked(false);
    }
    setAuthChecked(true);
  }, [tmdbId, mediaType]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const onClick = useCallback(async () => {
    if (!viewerId) {
      router.push(`/${lang}/signup`);
      return;
    }

    // Optimistic flip.
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount(c => Math.max(0, c + (wasLiked ? -1 : 1)));

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("title_likes")
          .delete()
          .eq("user_id", viewerId)
          .eq("tmdb_id", tmdbId)
          .eq("media_type", mediaType);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("title_likes")
          .upsert(
            { user_id: viewerId, tmdb_id: tmdbId, media_type: mediaType },
            { onConflict: "user_id,tmdb_id,media_type" }
          );
        if (error) throw error;
      }
    } catch (e) {
      console.error("[TitleLikeButton] toggle error", e);
      setLiked(wasLiked);
      setCount(c => Math.max(0, c + (wasLiked ? 1 : -1)));
    }
  }, [viewerId, liked, tmdbId, mediaType, router, lang]);

  if (!authChecked) {
    return (
      <button className="tl-btn tl-btn-placeholder" disabled aria-hidden>
        ♡
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`tl-btn ${liked ? "tl-btn-on" : ""}`}
        onClick={onClick}
        aria-label={labels.likeAria}
        title={labels.count(count)}
      >
        <span aria-hidden>{liked ? "♥" : "♡"}</span>
        {count > 0 && <span>{count}</span>}
      </button>

      <style>{`
        .tl-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 20px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.85); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background .15s, border-color .15s, color .15s;
          white-space: nowrap; touch-action: manipulation;
        }
        .tl-btn:hover {
          background: rgba(250,0,130,.18);
          border-color: rgba(250,0,130,.5);
          color: #fff;
        }
        .tl-btn-on {
          background: rgba(250,0,130,.16);
          border-color: rgba(250,0,130,.55);
          color: #FA0082;
        }
        .tl-btn-placeholder { opacity: .4; cursor: default; }
      `}</style>
    </>
  );
}
