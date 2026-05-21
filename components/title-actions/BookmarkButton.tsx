"use client";

// Bookmark entry point on the title detail page. Reads whether the
// current viewer has the title saved in ANY surface (watchlist or
// one of their peeklists, top5 included) so the button can render as
// filled magenta. Opens BookmarkModal on click.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BookmarkModal from "./BookmarkModal";
import { normalizeLang, TITLE_ACTION_TEXTS } from "./i18n";

type Props = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  lang: string;
};

export default function BookmarkButton({
  tmdbId,
  mediaType,
  title,
  posterPath,
  backdropPath,
  lang,
}: Props) {
  const router = useRouter();
  const texts = TITLE_ACTION_TEXTS[normalizeLang(lang)];

  const [authChecked, setAuthChecked] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [savedAnywhere, setSavedAnywhere] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Saved-anywhere = watchlist row OR any peeklist_item that joins back
  // to a peeklist this viewer owns. Two parallel queries to avoid a
  // join with the admin client (RLS already restricts to my data).
  const refresh = useCallback(async () => {
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp.user?.id ?? null;
    setViewerId(uid);
    if (!uid) {
      setSavedAnywhere(false);
      setAuthChecked(true);
      return;
    }

    const [wl, items] = await Promise.all([
      supabase
        .from("watchlist")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", uid)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType),
      supabase
        .from("peeklist_items")
        .select("peeklist_id, peeklists!inner(created_by)")
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType)
        .eq("peeklists.created_by", uid),
    ]);

    const inWatchlist = (wl.count ?? 0) > 0;
    const inPeeklist = (items.data ?? []).length > 0;
    setSavedAnywhere(inWatchlist || inPeeklist);
    setAuthChecked(true);
  }, [tmdbId, mediaType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onClick = useCallback(() => {
    if (!viewerId) {
      router.push(`/${lang}/signup`);
      return;
    }
    setModalOpen(true);
  }, [viewerId, lang, router]);

  if (!authChecked) {
    return (
      <button className="bk-btn bk-btn-placeholder" disabled aria-hidden>
        🔖 {texts.bookmark}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`bk-btn ${savedAnywhere ? "bk-btn-on" : ""}`}
        onClick={onClick}
        aria-label={savedAnywhere ? texts.bookmarked : texts.bookmark}
      >
        <span aria-hidden>{savedAnywhere ? "🔖" : "📑"}</span>
        {savedAnywhere ? texts.bookmarked : texts.bookmark}
      </button>

      <BookmarkModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          // Refresh on close — handles cases where saved-anywhere changed
          // without the inner callback firing (e.g. concurrent writes).
          refresh();
        }}
        tmdbId={tmdbId}
        mediaType={mediaType}
        title={title}
        posterPath={posterPath}
        backdropPath={backdropPath}
        texts={texts}
        onSavedChanged={setSavedAnywhere}
      />

      <style>{`
        .bk-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 20px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.85); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background .15s, border-color .15s, color .15s;
          white-space: nowrap; touch-action: manipulation;
        }
        .bk-btn:hover {
          background: rgba(250,0,130,.18);
          border-color: rgba(250,0,130,.5);
          color: #fff;
        }
        .bk-btn-on {
          background: rgba(250,0,130,.16);
          border-color: rgba(250,0,130,.55);
          color: #FA0082;
        }
        .bk-btn-placeholder { opacity: .4; cursor: default; }
      `}</style>
    </>
  );
}
