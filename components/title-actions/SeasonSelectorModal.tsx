"use client";

// Multi-select season picker — mirrors lib/widgets/season_selector_modal.dart.
// Pre-checks seasons the user already marked watched. On confirm, calls the
// existing Supabase RPC `sync_tv_seasons` (single round-trip diff) and
// resolves with the set of seasons that were newly added so the caller can
// open RateModal anchored to the most recent one.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import type { ActionTexts } from "./i18n";

export type TmdbSeason = {
  season_number: number;
  name: string | null;
  episode_count?: number | null;
  air_date?: string | null;
  poster_path?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  seasons: TmdbSeason[];
  initiallyWatched: Set<number>;
  texts: ActionTexts;
  // Resolves with the seasons newly added in this picker session (added
  // = selected \ initiallyWatched). Caller uses last(added) to drive
  // RateModal.
  onConfirmed: (result: { selected: number[]; added: number[] }) => void;
};

export default function SeasonSelectorModal({
  open,
  onClose,
  tmdbId,
  title,
  posterPath,
  seasons,
  initiallyWatched,
  texts,
  onConfirmed,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initiallyWatched));
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset whenever the modal is freshly opened so we don't show stale
  // selection from a previous session.
  useEffect(() => {
    if (open) setSelected(new Set(initiallyWatched));
  }, [open, initiallyWatched]);

  // Scroll lock + Escape handler — same pattern as ReviewsModal.
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
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Filter out "Specials" (season_number 0) and any malformed entries,
  // matching the Flutter behavior of only showing real seasons.
  const validSeasons = useMemo(
    () => seasons.filter(s => typeof s.season_number === "number" && s.season_number > 0),
    [seasons]
  );

  const toggle = useCallback((n: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }, []);

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    try {
      const selectedArr = Array.from(selected).sort((a, b) => a - b);
      const { error } = await supabase.rpc("sync_tv_seasons", {
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_tmdb_id: tmdbId,
        p_title: title,
        p_poster_path: posterPath,
        p_selected_seasons: selectedArr,
      });
      if (error) {
        console.error("[SeasonSelectorModal] sync_tv_seasons error", error);
        setSaving(false);
        return;
      }
      const added = selectedArr.filter(n => !initiallyWatched.has(n));
      onConfirmed({ selected: selectedArr, added });
      onClose();
    } catch (e) {
      console.error("[SeasonSelectorModal] confirm exception", e);
    } finally {
      setSaving(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="ssm-overlay"
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="ssm-panel">
        <div className="ssm-drag-handle" aria-hidden />
        <div className="ssm-header">
          <h2 className="ssm-title">{texts.selectSeasons}</h2>
          <button className="ssm-close" onClick={onClose} aria-label={texts.cancel}>✕</button>
        </div>

        <div className="ssm-body">
          {validSeasons.length === 0 ? (
            <div className="ssm-empty">{texts.loading}</div>
          ) : (
            validSeasons.map(s => {
              const isSelected = selected.has(s.season_number);
              const label = s.name && s.name.trim().length > 0
                ? s.name
                : texts.season(s.season_number);
              return (
                <button
                  key={s.season_number}
                  className={`ssm-row ${isSelected ? "ssm-row-on" : ""}`}
                  onClick={() => toggle(s.season_number)}
                  type="button"
                >
                  <span className="ssm-row-label">{label}</span>
                  <span className={`ssm-check ${isSelected ? "ssm-check-on" : ""}`}>
                    {isSelected ? "●" : "○"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="ssm-footer">
          <button
            className="ssm-confirm"
            disabled={saving}
            onClick={handleConfirm}
          >
            {saving ? texts.saving : texts.confirm}
          </button>
        </div>
      </div>

      <style>{`
        .ssm-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.75);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex; align-items: flex-end; justify-content: center;
          overscroll-behavior: none;
        }
        .ssm-panel {
          background: #0E0B14;
          width: 100%; max-width: 560px;
          max-height: 85vh;
          border-radius: 26px 26px 0 0;
          padding: 14px 20px 24px;
          display: flex; flex-direction: column;
          color: #fff;
        }
        @media (min-width: 720px) {
          .ssm-panel { border-radius: 22px; margin-bottom: 5vh; }
          .ssm-overlay { align-items: center; }
        }
        .ssm-drag-handle {
          width: 42px; height: 4px; border-radius: 99px;
          background: rgba(255,255,255,.22);
          margin: 0 auto 14px;
        }
        .ssm-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
        }
        .ssm-title { font-size: 20px; font-weight: 700; margin: 0; }
        .ssm-close {
          background: transparent; border: 0; color: rgba(255,255,255,.7);
          font-size: 18px; cursor: pointer; padding: 4px 8px;
        }
        .ssm-body {
          overflow-y: auto; flex: 1;
          display: flex; flex-direction: column; gap: 4px;
          margin: 0 -4px;
        }
        .ssm-empty {
          padding: 40px 0; text-align: center;
          color: rgba(255,255,255,.55);
        }
        .ssm-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 12px; border-radius: 12px;
          background: transparent; border: 0;
          color: #fff; font-size: 15px; cursor: pointer;
          transition: background .12s;
          text-align: left;
        }
        .ssm-row:hover { background: rgba(255,255,255,.05); }
        .ssm-row-on { background: rgba(250,0,130,.08); }
        .ssm-row-label { font-weight: 500; }
        .ssm-check {
          font-size: 22px; color: rgba(255,255,255,.32);
          width: 24px; text-align: center;
        }
        .ssm-check-on { color: #FA0082; }
        .ssm-footer { padding-top: 14px; }
        .ssm-confirm {
          width: 100%; padding: 14px;
          background: #FA0082; color: #fff;
          border: 0; border-radius: 14px;
          font-size: 16px; font-weight: 700;
          cursor: pointer;
        }
        .ssm-confirm:disabled {
          background: rgba(255,255,255,.12); cursor: not-allowed;
        }
      `}</style>
    </div>,
    document.body
  );
}
