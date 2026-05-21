"use client";

// Mirrors lib/screens/content/rate_modal.dart. Range 0.0–10.0, step 0.1,
// "vista nueva / vista anterior" toggle that writes user_title_activities
// .is_rewatch (true when watched-before — DB-side fanout triggers skip the
// follower broadcast when is_rewatch=true).
//
// For TV titles the modal updates the existing row anchored to
// seasonNumber (the row was already inserted by sync_tv_seasons before
// this modal opens). For movies it upserts user_title_activities directly.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import type { ActionTexts } from "./i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  // Required when mediaType === 'tv'; ignored otherwise.
  seasonNumber?: number | null;
  texts: ActionTexts;
  onSaved?: () => void;
};

export default function RateModal({
  open,
  onClose,
  tmdbId,
  mediaType,
  title,
  posterPath,
  releaseYear,
  seasonNumber,
  texts,
  onSaved,
}: Props) {
  const [rating, setRating] = useState(0);
  const [isNewWatch, setIsNewWatch] = useState(true);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadedExisting, setLoadedExisting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset state every time the modal opens, then pull any existing rating
  // so the slider/comment pre-fill (same flow as Flutter _loadExisting).
  useEffect(() => {
    if (!open) {
      setLoadedExisting(false);
      return;
    }
    setRating(0);
    setIsNewWatch(true);
    setComment("");

    (async () => {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp.user?.id;
      if (!uid) {
        setLoadedExisting(true);
        return;
      }
      let q = supabase
        .from("user_title_activities")
        .select("rating, is_rewatch")
        .eq("user_id", uid)
        .eq("tmdb_id", tmdbId)
        .limit(1);
      if (mediaType === "tv" && typeof seasonNumber === "number") {
        q = q.eq("season_number", seasonNumber);
      }
      const { data } = await q.maybeSingle();
      if (data?.rating != null) setRating(Number(data.rating));
      if (data?.is_rewatch === true) setIsNewWatch(false);
      setLoadedExisting(true);
    })();
  }, [open, tmdbId, mediaType, seasonNumber]);

  // Scroll lock + Escape, same pattern as ReviewsModal / SeasonSelectorModal.
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, saving]);

  const snap = useCallback((raw: number) => {
    const snapped = Math.round(raw * 10) / 10;
    return Math.max(0, Math.min(10, snapped));
  }, []);

  async function submit() {
    if (rating <= 0 || saving) return;
    setSaving(true);

    try {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp.user?.id;
      if (!uid) {
        setSaving(false);
        return;
      }

      const isRewatch = !isNewWatch;
      const nowIso = new Date().toISOString();

      // Look for an existing row first — same key as Flutter:
      // (user, tmdb) for movies, (user, tmdb, season) for TV.
      let lookup = supabase
        .from("user_title_activities")
        .select("id")
        .eq("user_id", uid)
        .eq("tmdb_id", tmdbId)
        .limit(1);
      if (mediaType === "tv" && typeof seasonNumber === "number") {
        lookup = lookup.eq("season_number", seasonNumber);
      }
      const { data: existing } = await lookup.maybeSingle();

      if (existing?.id) {
        await supabase
          .from("user_title_activities")
          .update({
            rating,
            title,
            media_type: mediaType,
            poster_path: posterPath,
            watched_at: nowIso,
            is_rewatch: isRewatch,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("user_title_activities").upsert(
          {
            user_id: uid,
            tmdb_id: tmdbId,
            title,
            media_type: mediaType,
            poster_path: posterPath,
            rating,
            watched_at: nowIso,
            release_year: releaseYear,
            season_number: mediaType === "tv" ? seasonNumber ?? null : null,
            is_rewatch: isRewatch,
          },
          { onConflict: "user_id,tmdb_id,season_number" }
        );
      }

      // Remove from watchlist if it was there (Flutter does the same).
      await supabase
        .from("watchlist")
        .delete()
        .eq("user_id", uid)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType);

      const cleanComment = comment.trim();
      if (cleanComment.length > 0) {
        await supabase.from("comments").insert({
          tmdb_id: tmdbId,
          user_id: uid,
          comment: cleanComment,
        });
      }

      onSaved?.();
      onClose();
    } catch (e) {
      console.error("[RateModal] submit error", e);
    } finally {
      setSaving(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="rm-overlay"
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && !saving && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="rm-panel">
        <div className="rm-drag-handle" aria-hidden />

        <h2 className="rm-title">{texts.rateThisTitle}</h2>

        <div className="rm-display">
          <div className="rm-display-number">
            {rating > 0 ? rating.toFixed(1) : "—"}
          </div>
          <div className="rm-display-sub">
            {rating > 0 ? texts.over10 : texts.slideToRate}
          </div>
        </div>

        <div className="rm-slider-wrap">
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={rating}
            onChange={e => setRating(snap(parseFloat(e.target.value)))}
            className="rm-slider"
            aria-label={texts.rateThisTitle}
          />
          <div className="rm-scale">
            <span>1</span><span>5</span><span>10</span>
          </div>
        </div>

        <div className="rm-toggle">
          <button
            type="button"
            className={`rm-chip ${isNewWatch ? "rm-chip-on" : ""}`}
            onClick={() => setIsNewWatch(true)}
          >
            {texts.newWatch}
          </button>
          <button
            type="button"
            className={`rm-chip ${!isNewWatch ? "rm-chip-on" : ""}`}
            onClick={() => setIsNewWatch(false)}
          >
            {texts.watchedBefore}
          </button>
        </div>
        <div className="rm-toggle-help">
          {isNewWatch ? texts.newWatchHelp : texts.watchedBeforeHelp}
        </div>

        <textarea
          className="rm-comment"
          placeholder={texts.writeComment}
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
        />

        <button
          type="button"
          className="rm-save"
          disabled={rating === 0 || saving || !loadedExisting}
          onClick={submit}
        >
          {saving ? texts.saving : texts.save}
        </button>
      </div>

      <style>{`
        .rm-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.75);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex; align-items: flex-end; justify-content: center;
          overscroll-behavior: none;
        }
        .rm-panel {
          background: #0E0B14;
          width: 100%; max-width: 520px;
          padding: 14px 20px 24px;
          border-radius: 26px 26px 0 0;
          color: #fff;
        }
        @media (min-width: 720px) {
          .rm-panel { border-radius: 22px; margin-bottom: 6vh; }
          .rm-overlay { align-items: center; }
        }
        .rm-drag-handle {
          width: 42px; height: 4px; border-radius: 99px;
          background: rgba(255,255,255,.22);
          margin: 0 auto 14px;
        }
        .rm-title {
          margin: 0 0 18px; text-align: center;
          font-size: 22px; font-weight: 800;
        }
        .rm-display { text-align: center; margin-bottom: 4px; }
        .rm-display-number {
          font-size: 56px; font-weight: 800;
          color: #FA0082; line-height: 1; letter-spacing: -1px;
        }
        .rm-display-sub {
          margin-top: 4px; color: rgba(255,255,255,.6);
          font-size: 14px; font-weight: 600;
        }
        .rm-slider-wrap { margin: 12px 0 4px; }
        .rm-slider {
          width: 100%; -webkit-appearance: none; appearance: none;
          height: 6px; border-radius: 99px;
          background: rgba(255,255,255,.12);
          outline: none;
        }
        .rm-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 22px; height: 22px; border-radius: 50%;
          background: #FA0082; cursor: pointer;
          border: 2px solid #fff;
        }
        .rm-slider::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%;
          background: #FA0082; cursor: pointer; border: 2px solid #fff;
        }
        .rm-scale {
          display: flex; justify-content: space-between;
          padding: 6px 8px 0; color: rgba(255,255,255,.35);
          font-size: 12px;
        }
        .rm-toggle {
          display: flex; gap: 10px;
          margin: 20px 0 8px;
        }
        .rm-chip {
          flex: 1; padding: 10px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.55);
          font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all .15s;
        }
        .rm-chip-on {
          background: rgba(250,0,130,.14);
          border-color: #FA0082;
          color: #FA0082;
          font-weight: 700;
        }
        .rm-toggle-help {
          color: rgba(255,255,255,.38);
          font-size: 12px; margin-bottom: 18px;
        }
        .rm-comment {
          width: 100%; resize: vertical; min-height: 80px;
          background: rgba(255,255,255,.06);
          color: #fff; border: 0;
          padding: 12px; border-radius: 10px;
          font-family: inherit; font-size: 14px;
          margin-bottom: 22px;
        }
        .rm-comment::placeholder { color: rgba(255,255,255,.4); }
        .rm-save {
          width: 100%; padding: 15px;
          background: #FA0082; color: #000;
          border: 0; border-radius: 14px;
          font-size: 16px; font-weight: 800;
          cursor: pointer;
        }
        .rm-save:disabled {
          background: rgba(255,255,255,.12); color: rgba(255,255,255,.4);
          cursor: not-allowed;
        }
      `}</style>
    </div>,
    document.body
  );
}
