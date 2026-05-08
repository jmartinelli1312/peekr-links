"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewItem } from "@/app/api/reviews/route";

// ─────────────────────────────────────────────────────────────────────────────
// Rating badge  — Peekr scale is 1-10, NOT stars
// ─────────────────────────────────────────────────────────────────────────────
function RatingBadge({ rating }: { rating: number }) {
  const color =
    rating >= 8 ? "#22c55e" :   // green
    rating >= 5 ? "#f59e0b" :   // amber
                  "#ef4444";    // red
  return (
    <span
      className="rating-badge"
      style={{ color, borderColor: color + "44", background: color + "18" }}
      aria-label={`${rating} de 10`}
    >
      ★ {rating}<span className="rating-badge-denom">/10</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
function Avatar({ url, name }: { url: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
  if (url && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="r-avatar" onError={() => setErr(true)} />;
  }
  return <div className="r-avatar r-avatar-init">{initials || "?"}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Translation helper — unofficial Google Translate (free, no key)
// ─────────────────────────────────────────────────────────────────────────────
async function gtranslate(text: string, targetLang: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("translate error");
  const data = await res.json();
  // data[0] is array of [translatedChunk, originalChunk, ...]
  return (data[0] as [string][]).map(s => s[0]).join("");
}

function browserLang(): string {
  if (typeof navigator === "undefined") return "es";
  return navigator.language.split("-")[0].toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Single review card
// ─────────────────────────────────────────────────────────────────────────────
interface CardProps {
  review: ReviewItem;
  targetLang: string;           // language to translate to
  autoTranslate: boolean;       // if true, translate on mount
  translatedText: string | null;
  onTranslated: (id: number, text: string) => void;
}

function ReviewCard({ review, targetLang, autoTranslate, translatedText, onTranslated }: CardProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [failed, setFailed] = useState(false);

  const displayName = review.display_name || review.username;
  const date = new Date(review.created_at).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });

  const translate = useCallback(async () => {
    if (translatedText || translating) return;
    setTranslating(true);
    setFailed(false);
    try {
      const t = await gtranslate(review.comment, targetLang);
      onTranslated(review.id, t);
    } catch {
      setFailed(true);
    } finally {
      setTranslating(false);
    }
  }, [translatedText, translating, review.comment, review.id, targetLang, onTranslated]);

  // Auto-translate on mount if requested
  useEffect(() => {
    if (autoTranslate && !translatedText && !translating) {
      translate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslate]);

  const bodyText =
    translatedText && !showOriginal ? translatedText : review.comment;

  const canTranslate = !translatedText && !translating;
  const isTranslated = !!translatedText && !showOriginal;

  return (
    <article className="r-card">
      {/* Header row */}
      <div className="r-header">
        <Avatar url={review.avatar_url} name={displayName} />
        <div className="r-meta">
          <div className="r-name-row">
            <span className="r-username">{displayName}</span>
            {review.is_creator && (
              <span className="r-badge">✓ Creador</span>
            )}
          </div>
          <span className="r-handle">@{review.username}</span>
        </div>
        {review.rating !== null && (
          <RatingBadge rating={review.rating} />
        )}
      </div>

      {/* Comment body */}
      {translating ? (
        <p className="r-body r-translating">Traduciendo…</p>
      ) : (
        <p className="r-body">{bodyText}</p>
      )}

      {/* Footer */}
      <div className="r-footer">
        <span className="r-date">{date}</span>
        <div className="r-footer-right">
          {review.like_count > 0 && (
            <span className="r-likes">♥ {review.like_count}</span>
          )}
          {/* Translate toggle */}
          {failed && (
            <button className="r-translate-btn r-translate-err" onClick={translate}>
              Reintentar
            </button>
          )}
          {!failed && canTranslate && (
            <button className="r-translate-btn" onClick={translate}>
              🌐 Traducir
            </button>
          )}
          {!failed && isTranslated && (
            <button className="r-translate-btn r-translated" onClick={() => setShowOriginal(true)}>
              Ver original
            </button>
          )}
          {!failed && translatedText && showOriginal && (
            <button className="r-translate-btn" onClick={() => setShowOriginal(false)}>
              🌐 Traducido
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  tmdbId: number;
  mediaType: string;
  title: string;
  label: string;
  count?: number;
}

export default function ReviewsModal({ tmdbId, mediaType, title, label, count }: Props) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Translation state: id → translated text
  const [translations, setTranslations] = useState<Record<number, string>>({});
  // Whether to auto-translate all (true when browser lang != 'es' by default)
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [targetLang, setTargetLang] = useState("es");

  const overlayRef = useRef<HTMLDivElement>(null);

  // Compute browser language once on open
  const initLang = useRef(false);
  useEffect(() => {
    if (!open || initLang.current) return;
    initLang.current = true;
    const lang = browserLang();
    setTargetLang(lang);
    // Auto-translate if browser is not Spanish
    if (lang !== "es") setAutoTranslate(true);
  }, [open]);

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  async function openModal() {
    setOpen(true);
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?tmdb_id=${tmdbId}&type=${mediaType}`);
      const json = await res.json();
      setReviews(json.reviews ?? []);
      setFetched(true);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  const handleTranslated = useCallback((id: number, text: string) => {
    setTranslations(prev => ({ ...prev, [id]: text }));
  }, []);

  function toggleTranslateAll() {
    setAutoTranslate(v => !v);
  }

  const translateAllLabel = autoTranslate
    ? "Ver originales"
    : `🌐 Traducir al ${langName(targetLang)}`;

  return (
    <>
      {/* ── Trigger ── */}
      <button className="reviews-btn" onClick={openModal} aria-label={label}>
        <span>💬</span>
        {label}
        {count !== undefined && count > 0 && (
          <span className="reviews-btn-count">{count}</span>
        )}
      </button>

      {/* ── Modal ── */}
      {open && (
        <div
          className="r-overlay"
          ref={overlayRef}
          onClick={e => e.target === overlayRef.current && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="r-panel">
            {/* Header */}
            <div className="r-panel-header">
              <div>
                <h2 className="r-panel-title">Reseñas</h2>
                <p className="r-panel-sub">{title}</p>
              </div>
              <div className="r-header-actions">
                {reviews.length > 0 && (
                  <button
                    className={`r-translate-all-btn ${autoTranslate ? "active" : ""}`}
                    onClick={toggleTranslateAll}
                    title={translateAllLabel}
                  >
                    🌐 {autoTranslate ? "Originales" : langName(targetLang)}
                  </button>
                )}
                <button className="r-close" onClick={() => setOpen(false)} aria-label="Cerrar">
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="r-panel-body">
              {loading && (
                <div className="r-loading">
                  <div className="r-spinner" />
                </div>
              )}
              {!loading && fetched && reviews.length === 0 && (
                <div className="r-empty">Todavía no hay reseñas para este título.</div>
              )}
              {!loading && reviews.map(r => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  targetLang={targetLang}
                  autoTranslate={autoTranslate}
                  translatedText={translations[r.id] ?? null}
                  onTranslated={handleTranslated}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Trigger */
        .reviews-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 20px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.85); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background .15s, border-color .15s;
          white-space: nowrap;
        }
        .reviews-btn:hover { background: rgba(168,85,247,.18); border-color: rgba(168,85,247,.5); color: #fff; }
        .reviews-btn-count {
          background: #a855f7; color: #fff; font-size: 11px; font-weight: 700;
          border-radius: 10px; padding: 1px 7px; margin-left: 2px;
        }

        /* Overlay */
        .r-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.75);
          backdrop-filter: blur(4px); z-index: 1000;
          display: flex; align-items: flex-end; justify-content: center;
        }
        @media (min-width: 640px) { .r-overlay { align-items: center; padding: 24px; } }

        /* Panel */
        .r-panel {
          background: #0f1014; border: 1px solid rgba(255,255,255,.1);
          border-radius: 20px 20px 0 0; width: 100%; max-width: 660px;
          max-height: 88vh; display: flex; flex-direction: column; overflow: hidden;
        }
        @media (min-width: 640px) { .r-panel { border-radius: 20px; max-height: 82vh; } }

        /* Panel header */
        .r-panel-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 18px 18px 14px; border-bottom: 1px solid rgba(255,255,255,.08);
          flex-shrink: 0; gap: 12px;
        }
        .r-panel-title { font-size: 18px; font-weight: 800; color: #fff; margin: 0 0 2px; }
        .r-panel-sub {
          font-size: 12px; color: rgba(255,255,255,.4); margin: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;
        }
        .r-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        /* Translate-all button */
        .r-translate-all-btn {
          font-size: 12px; font-weight: 600; padding: 4px 12px;
          border-radius: 14px; border: 1px solid rgba(255,255,255,.2);
          background: rgba(255,255,255,.06); color: rgba(255,255,255,.7);
          cursor: pointer; white-space: nowrap; transition: all .15s;
        }
        .r-translate-all-btn:hover { background: rgba(168,85,247,.2); border-color: rgba(168,85,247,.5); color: #fff; }
        .r-translate-all-btn.active { background: rgba(168,85,247,.2); border-color: #a855f7; color: #d8b4fe; }

        .r-close {
          background: none; border: none; color: rgba(255,255,255,.5);
          font-size: 18px; cursor: pointer; padding: 0; line-height: 1;
        }
        .r-close:hover { color: #fff; }

        /* Body */
        .r-panel-body {
          overflow-y: auto; padding: 8px 16px 28px; flex: 1;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.15) transparent;
        }

        /* Spinner */
        .r-loading { display: flex; justify-content: center; padding: 48px 0; }
        .r-spinner {
          width: 28px; height: 28px; border: 3px solid rgba(168,85,247,.3);
          border-top-color: #a855f7; border-radius: 50%; animation: r-spin .7s linear infinite;
        }
        @keyframes r-spin { to { transform: rotate(360deg); } }
        .r-empty { text-align: center; color: rgba(255,255,255,.3); font-size: 14px; padding: 48px 0; }

        /* Card */
        .r-card { padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,.07); }
        .r-card:last-child { border-bottom: none; }

        .r-header { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 9px; }

        /* Avatar */
        .r-avatar {
          width: 38px; height: 38px; border-radius: 50%; object-fit: cover;
          flex-shrink: 0; border: 2px solid rgba(255,255,255,.1);
        }
        .r-avatar-init {
          background: linear-gradient(135deg,#7c3aed,#a855f7);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: #fff;
        }

        .r-meta { flex: 1; min-width: 0; }
        .r-name-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 1px; }
        .r-username { font-size: 14px; font-weight: 700; color: #fff; }
        .r-handle { font-size: 11px; color: rgba(255,255,255,.3); }

        /* Creator badge */
        .r-badge {
          font-size: 10px; font-weight: 700; color: #a855f7;
          background: rgba(168,85,247,.15); border: 1px solid rgba(168,85,247,.3);
          border-radius: 10px; padding: 1px 7px;
        }

        /* Rating badge — 10-point scale */
        .rating-badge {
          font-size: 13px; font-weight: 700;
          border: 1px solid; border-radius: 8px;
          padding: 3px 8px; flex-shrink: 0;
          font-variant-numeric: tabular-nums;
        }
        .rating-badge-denom { font-size: 10px; opacity: .6; margin-left: 1px; }

        /* Body */
        .r-body { font-size: 14px; color: rgba(255,255,255,.85); line-height: 1.55; margin: 0 0 8px; word-break: break-word; }
        .r-translating { color: rgba(255,255,255,.35); font-style: italic; }

        /* Footer */
        .r-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .r-footer-right { display: flex; align-items: center; gap: 8px; }
        .r-date { font-size: 11px; color: rgba(255,255,255,.25); }
        .r-likes { font-size: 11px; color: rgba(255,255,255,.3); }

        /* Per-review translate button */
        .r-translate-btn {
          font-size: 11px; color: rgba(255,255,255,.35); background: none;
          border: none; cursor: pointer; padding: 0; text-decoration: underline;
          text-underline-offset: 2px; transition: color .1s;
        }
        .r-translate-btn:hover { color: rgba(255,255,255,.7); }
        .r-translated { color: rgba(168,85,247,.6); }
        .r-translate-err { color: #ef4444; }
      `}</style>
    </>
  );
}

// ─── Map ISO lang code to readable name ───────────────────────────────────────
function langName(code: string): string {
  const names: Record<string, string> = {
    es: "Español", en: "English", pt: "Português", fr: "Français",
    de: "Deutsch", it: "Italiano", zh: "中文", ja: "日本語",
    ko: "한국어", ru: "Русский", ar: "العربية", hi: "हिन्दी",
    nl: "Nederlands", pl: "Polski", tr: "Türkçe", sv: "Svenska",
    da: "Dansk", fi: "Suomi", he: "עברית",
  };
  return names[code] ?? code.toUpperCase();
}
