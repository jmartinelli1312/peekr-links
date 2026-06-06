"use client";

// Bookmark sheet — mirrors lib/widgets/bookmark_modal.dart.
// Rows in order: Watchlist, My Top 5 (default list), then user's custom
// peeklists. Tapping a row toggles membership for that bucket. The "+"
// next to the Peeklists header opens an inline create form; once the
// user has 3 custom lists the "+" instead opens the PremiumWaitlistModal.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import type { ActionTexts } from "./i18n";
import PremiumWaitlistModal from "./PremiumWaitlistModal";

type PeeklistRow = {
  id: string;
  title: string;
  list_type: "custom" | "top5";
};

type Props = {
  open: boolean;
  onClose: () => void;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  texts: ActionTexts;
  // Fired when the modal's saved-anywhere state flips, so the trigger
  // button can update its filled-bookmark indicator without a refetch.
  onSavedChanged?: (saved: boolean) => void;
};

export default function BookmarkModal({
  open,
  onClose,
  tmdbId,
  mediaType,
  title,
  posterPath,
  backdropPath,
  texts,
  onSavedChanged,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [loading, setLoading] = useState(true);
  const [savedInWatchlist, setSavedInWatchlist] = useState(false);
  const [top5, setTop5] = useState<PeeklistRow | null>(null);
  const [top5Count, setTop5Count] = useState(0);
  const [customLists, setCustomLists] = useState<PeeklistRow[]>([]);
  const [memberSet, setMemberSet] = useState<Set<string>>(new Set());

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);

  const atCustomLimit = customLists.length >= 3;

  // Saved-anywhere across watchlist / top5 / custom. Fires the parent
  // callback whenever the underlying state changes.
  const savedAnywhere = savedInWatchlist || memberSet.size > 0;
  useEffect(() => {
    onSavedChanged?.(savedAnywhere);
  }, [savedAnywhere, onSavedChanged]);

  // Bulk-load watchlist + peeklists + memberships in parallel when the
  // modal opens. Same shape as the Flutter modal's _load().
  const load = useCallback(async () => {
    setLoading(true);
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    // Ensure the Top 5 list exists before we list peeklists.
    await supabase.rpc("ensure_top5_peeklist", { p_user_id: uid });

    const [peeklistsRes, memberRes, watchlistRes] = await Promise.all([
      supabase
        .from("peeklists")
        .select("id, title, list_type")
        .eq("created_by", uid),
      supabase
        .from("peeklist_items")
        .select("peeklist_id")
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType),
      supabase
        .from("watchlist")
        .select("id")
        .eq("user_id", uid)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType)
        .maybeSingle(),
    ]);

    const allLists =
      (peeklistsRes.data as PeeklistRow[] | null) ?? [];
    const memberRows =
      (memberRes.data as { peeklist_id: string }[] | null) ?? [];
    const inWatchlist = Boolean(watchlistRes.data);

    let top5Row: PeeklistRow | null = null;
    const custom: PeeklistRow[] = [];
    for (const p of allLists) {
      if (p.list_type === "top5" && !top5Row) top5Row = p;
      else if (p.list_type !== "top5") custom.push(p);
    }

    // Count items in Top 5 (cap is 5, displayed as "x/5" hint).
    let top5N = 0;
    if (top5Row) {
      const { count } = await supabase
        .from("peeklist_items")
        .select("id", { count: "exact", head: true })
        .eq("peeklist_id", top5Row.id);
      top5N = count ?? 0;
    }

    setTop5(top5Row);
    setTop5Count(top5N);
    setCustomLists(custom);
    setMemberSet(new Set(memberRows.map(r => r.peeklist_id)));
    setSavedInWatchlist(inWatchlist);
    setLoading(false);
  }, [tmdbId, mediaType]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Scroll lock + Escape.
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

  // ── Toggles ──────────────────────────────────────────────────────────
  async function toggleWatchlist() {
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp.user?.id;
    if (!uid) return;
    const wasSaved = savedInWatchlist;
    setSavedInWatchlist(!wasSaved);
    try {
      if (wasSaved) {
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", uid)
          .eq("tmdb_id", tmdbId)
          .eq("media_type", mediaType);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("watchlist").upsert(
          {
            user_id: uid,
            tmdb_id: tmdbId,
            media_type: mediaType,
            title,
            poster_path: posterPath,
          },
          { onConflict: "user_id,tmdb_id,media_type" }
        );
        if (error) throw error;
      }
    } catch (e) {
      console.error("[BookmarkModal] toggleWatchlist", e);
      setSavedInWatchlist(wasSaved); // revert
    }
  }

  async function toggleTop5() {
    if (!top5) return;
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp.user?.id;
    if (!uid) return;
    const already = memberSet.has(top5.id);

    if (already) {
      // Remove
      const nextSet = new Set(memberSet);
      nextSet.delete(top5.id);
      setMemberSet(nextSet);
      setTop5Count(c => Math.max(0, c - 1));
      try {
        const { error } = await supabase
          .from("peeklist_items")
          .delete()
          .eq("peeklist_id", top5.id)
          .eq("tmdb_id", tmdbId)
          .eq("media_type", mediaType);
        if (error) throw error;
      } catch (e) {
        console.error("[BookmarkModal] toggleTop5 remove", e);
        const revert = new Set(memberSet);
        revert.add(top5.id);
        setMemberSet(revert);
        setTop5Count(c => c + 1);
      }
      return;
    }

    if (top5Count >= 5) {
      alert(texts.top5Full);
      return;
    }

    const nextSet = new Set(memberSet);
    nextSet.add(top5.id);
    setMemberSet(nextSet);
    const newCount = top5Count + 1;
    setTop5Count(newCount);
    try {
      const { error } = await supabase.from("peeklist_items").insert({
        peeklist_id: top5.id,
        tmdb_id: tmdbId,
        media_type: mediaType,
        position: newCount,
        added_by: uid,
        poster_path: posterPath,
        title,
      });
      if (error) throw error;
    } catch (e) {
      console.error("[BookmarkModal] toggleTop5 add", e);
      const revert = new Set(memberSet);
      revert.delete(top5.id);
      setMemberSet(revert);
      setTop5Count(c => Math.max(0, c - 1));
      if (String(e).includes("TOP5_ITEM_LIMIT_REACHED")) {
        alert(texts.top5Full);
      }
    }
  }

  async function addToCustom(p: PeeklistRow) {
    if (memberSet.has(p.id)) return;
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp.user?.id;
    if (!uid) return;

    const next = new Set(memberSet);
    next.add(p.id);
    setMemberSet(next);
    try {
      const { error } = await supabase.from("peeklist_items").insert({
        peeklist_id: p.id,
        tmdb_id: tmdbId,
        media_type: mediaType,
        position: 999,
        added_by: uid,
        poster_path: posterPath,
        title,
      });
      if (error) throw error;
    } catch (e) {
      console.error("[BookmarkModal] addToCustom", e);
      const revert = new Set(memberSet);
      revert.delete(p.id);
      setMemberSet(revert);
    }
  }

  // The "+" next to Peeklists header. Opens the inline form unless the
  // user has hit the 3-list cap, in which case route to premium upsell.
  function onPlusClick() {
    if (atCustomLimit && !showCreate) {
      setPremiumOpen(true);
      return;
    }
    setShowCreate(v => !v);
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (name.length === 0) return;
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp.user?.id;
    if (!uid) return;
    setCreating(true);
    try {
      // Match Flutter cover-url derivation order: backdrop > poster.
      const coverUrl = backdropPath
        ? `https://image.tmdb.org/t/p/w780${backdropPath}`
        : posterPath
          ? `https://image.tmdb.org/t/p/w500${posterPath}`
          : null;

      const { data, error } = await supabase
        .from("peeklists")
        .insert({
          title: name,
          visibility: "private",
          created_by: uid,
          cover_url: coverUrl,
          editorial_state: "draft",
        })
        .select("id, title, list_type")
        .single();
      if (error) throw error;

      const newList = data as PeeklistRow;

      // Now add the title to the freshly created list. supabase-js returns
      // { error } rather than throwing, so check it explicitly — otherwise
      // the list is created but the title silently never gets added. On
      // failure, roll back the just-created (empty) list so we don't orphan
      // it, then surface the error.
      const { error: itemErr } = await supabase.from("peeklist_items").insert({
        peeklist_id: newList.id,
        tmdb_id: tmdbId,
        media_type: mediaType,
        position: 0,
        added_by: uid,
        poster_path: posterPath,
        title,
      });
      if (itemErr) {
        await supabase.from("peeklists").delete().eq("id", newList.id);
        throw itemErr;
      }

      setCustomLists(prev => [...prev, newList]);
      const next = new Set(memberSet);
      next.add(newList.id);
      setMemberSet(next);
      setNewName("");
      setShowCreate(false);
    } catch (e) {
      console.error("[BookmarkModal] createAndAdd", e);
      if (String(e).includes("PEEKLIST_LIMIT_REACHED")) {
        setPremiumOpen(true);
      }
    } finally {
      setCreating(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div
        className="bm-overlay"
        ref={overlayRef}
        onClick={e => e.target === overlayRef.current && onClose()}
        role="dialog"
        aria-modal="true"
      >
        <div className="bm-panel">
          <div className="bm-drag-handle" aria-hidden />
          <h2 className="bm-title">{texts.saveTitle}</h2>

          {loading ? (
            <div className="bm-loading">…</div>
          ) : (
            <>
              <Row
                icon="🔖"
                label={texts.myWatchlist}
                saved={savedInWatchlist}
                onClick={toggleWatchlist}
              />
              {top5 && (
                <Row
                  icon="🏆"
                  label={texts.myTop5}
                  saved={memberSet.has(top5.id)}
                  trailing={`${top5Count}/5`}
                  onClick={toggleTop5}
                />
              )}

              <div className="bm-divider" />

              <div className="bm-section-head">
                <span className="bm-section-label">{texts.myPeeklists}</span>
                <button
                  type="button"
                  className="bm-plus"
                  onClick={onPlusClick}
                  aria-label="+"
                >
                  {showCreate ? "✕" : "＋"}
                </button>
              </div>

              {showCreate && (
                <div className="bm-create-row">
                  <input
                    className="bm-create-input"
                    placeholder={texts.listName}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    disabled={creating}
                    autoFocus
                  />
                  <button
                    className="bm-create-btn"
                    onClick={createAndAdd}
                    disabled={creating || newName.trim().length === 0}
                  >
                    {creating ? "…" : texts.create}
                  </button>
                </div>
              )}

              {customLists.length === 0 ? (
                <div className="bm-empty">{texts.noListsYet}</div>
              ) : (
                <div className="bm-list">
                  {customLists.map(p => (
                    <Row
                      key={p.id}
                      icon="📋"
                      label={p.title}
                      saved={memberSet.has(p.id)}
                      onClick={() => addToCustom(p)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <style>{`
          .bm-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,.75);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 9999;
            display: flex; align-items: flex-end; justify-content: center;
          }
          @media (min-width: 720px) {
            .bm-overlay { align-items: center; padding: 24px; }
          }
          .bm-panel {
            background: #111;
            width: 100%; max-width: 520px;
            padding: 12px 0 28px;
            border-radius: 24px 24px 0 0;
            color: #fff;
            max-height: 80vh;
            overflow-y: auto;
          }
          @media (min-width: 720px) { .bm-panel { border-radius: 22px; } }
          .bm-drag-handle {
            width: 36px; height: 4px; border-radius: 99px;
            background: rgba(255,255,255,.22);
            margin: 0 auto 16px;
          }
          .bm-title {
            margin: 0 20px 16px; font-size: 17px; font-weight: 700;
          }
          .bm-loading {
            padding: 30px; text-align: center; color: rgba(255,255,255,.5);
          }
          .bm-divider {
            margin: 12px 20px;
            border-top: 1px solid rgba(255,255,255,.08);
          }
          .bm-section-head {
            display: flex; align-items: center;
            padding: 0 20px 8px;
          }
          .bm-section-label {
            flex: 1; color: rgba(255,255,255,.7);
            font-size: 13px; font-weight: 600;
          }
          .bm-plus {
            background: none; border: 0; color: #FA0082;
            font-size: 22px; cursor: pointer; line-height: 1;
            padding: 4px 8px;
          }
          .bm-create-row {
            display: flex; gap: 10px;
            padding: 0 20px 12px;
          }
          .bm-create-input {
            flex: 1; background: rgba(255,255,255,.08);
            color: #fff; border: 0; border-radius: 10px;
            padding: 10px 14px; font-size: 14px;
          }
          .bm-create-input::placeholder { color: rgba(255,255,255,.38); }
          .bm-create-btn {
            background: #FA0082; color: #fff;
            border: 0; border-radius: 10px;
            padding: 0 16px; font-size: 13px; font-weight: 700;
            cursor: pointer;
          }
          .bm-create-btn:disabled {
            background: rgba(255,255,255,.12); cursor: not-allowed;
          }
          .bm-empty {
            padding: 8px 20px;
            color: rgba(255,255,255,.4); font-size: 13px;
          }
          .bm-list { max-height: 220px; overflow-y: auto; }

          .bm-row {
            display: flex; align-items: center; gap: 12px;
            padding: 10px 20px;
            background: transparent; border: 0;
            color: #fff; font-size: 15px; cursor: pointer;
            transition: background .12s;
            text-align: left; width: 100%;
          }
          .bm-row:hover { background: rgba(255,255,255,.04); }
          .bm-row-icon {
            font-size: 18px; line-height: 1;
            width: 22px; text-align: center;
            color: rgba(255,255,255,.7);
          }
          .bm-row-label {
            flex: 1; overflow: hidden; text-overflow: ellipsis;
            white-space: nowrap;
          }
          .bm-row-trailing {
            color: rgba(255,255,255,.4); font-size: 12px;
            margin-right: 8px;
          }
          .bm-row-check {
            font-size: 18px; width: 22px; text-align: center;
            color: rgba(255,255,255,.22);
          }
          .bm-row-check-on { color: #FA0082; }
        `}</style>
      </div>

      <PremiumWaitlistModal
        open={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        texts={texts}
      />
    </>,
    document.body
  );
}

function Row({
  icon,
  label,
  saved,
  trailing,
  onClick,
}: {
  icon: string;
  label: string;
  saved: boolean;
  trailing?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="bm-row" onClick={onClick}>
      <span className="bm-row-icon" aria-hidden>{icon}</span>
      <span className="bm-row-label">{label}</span>
      {trailing && <span className="bm-row-trailing">{trailing}</span>}
      <span className={`bm-row-check ${saved ? "bm-row-check-on" : ""}`}>
        {saved ? "●" : "○"}
      </span>
    </button>
  );
}
