"use client";

import { useEffect, useRef, useState } from "react";
import type { ReviewItem } from "@/app/api/reviews/route";

// ─── Star renderer (rating 1-10 → 5 stars with halves) ───────────────────────
function Stars({ rating }: { rating: number }) {
  const stars = [];
  const full = Math.floor(rating / 2);
  const half = rating % 2 >= 1;
  for (let i = 0; i < 5; i++) {
    if (i < full) stars.push("full");
    else if (i === full && half) stars.push("half");
    else stars.push("empty");
  }
  return (
    <span className="review-stars" aria-label={`${rating}/10`}>
      {stars.map((s, i) => (
        <span key={i} className={`star star-${s}`}>
          {s === "full" ? "★" : s === "half" ? "⯨" : "☆"}
        </span>
      ))}
      <span className="review-rating-num">{rating}/10</span>
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ url, name }: { url: string | null; name: string }) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (url && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="review-avatar"
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div className="review-avatar review-avatar-initials">
      {initials || "?"}
    </div>
  );
}

// ─── Single review card ───────────────────────────────────────────────────────
function ReviewCard({ review }: { review: ReviewItem }) {
  const displayName = review.display_name || review.username;
  const date = new Date(review.created_at).toLocaleDateString("es", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="review-card">
      <div className="review-header">
        <Avatar url={review.avatar_url} name={displayName} />
        <div className="review-meta">
          <div className="review-name-row">
            <span className="review-username">{displayName}</span>
            {review.is_creator && (
              <span className="review-badge" title="Creador verificado">
                ✓ Creador
              </span>
            )}
          </div>
          <span className="review-handle">@{review.username}</span>
        </div>
        {review.rating !== null && (
          <div className="review-rating-block">
            <Stars rating={review.rating} />
          </div>
        )}
      </div>
      <p className="review-body">{review.comment}</p>
      <div className="review-footer">
        <span className="review-date">{date}</span>
        {review.like_count > 0 && (
          <span className="review-likes">♥ {review.like_count}</span>
        )}
      </div>
    </article>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface Props {
  tmdbId: number;
  mediaType: string;
  title: string;
  label: string; // translated "Ver comentarios y reseñas"
  count?: number; // pre-known count from SSR
}

export default function ReviewsModal({ tmdbId, mediaType, title, label, count }: Props) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Lock scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) setOpen(false);
  }

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        className="reviews-btn"
        onClick={openModal}
        aria-label={label}
      >
        <span className="reviews-btn-icon">💬</span>
        {label}
        {count !== undefined && count > 0 && (
          <span className="reviews-btn-count">{count}</span>
        )}
      </button>

      {/* ── Modal overlay ── */}
      {open && (
        <div
          className="reviews-overlay"
          ref={overlayRef}
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-label={`Reseñas de ${title}`}
        >
          <div className="reviews-panel">
            {/* Header */}
            <div className="reviews-panel-header">
              <div>
                <h2 className="reviews-panel-title">Reseñas</h2>
                <p className="reviews-panel-sub">{title}</p>
              </div>
              <button
                className="reviews-close"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="reviews-panel-body">
              {loading && (
                <div className="reviews-loading">
                  <div className="reviews-spinner" />
                </div>
              )}

              {!loading && reviews.length === 0 && fetched && (
                <div className="reviews-empty">
                  Todavía no hay reseñas para este título.
                </div>
              )}

              {!loading && reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── Button ── */
        .reviews-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.85);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s, border-color .15s;
          white-space: nowrap;
        }
        .reviews-btn:hover {
          background: rgba(168,85,247,.18);
          border-color: rgba(168,85,247,.5);
          color: #fff;
        }
        .reviews-btn-icon { font-size: 14px; }
        .reviews-btn-count {
          background: #a855f7;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          border-radius: 10px;
          padding: 1px 7px;
          margin-left: 2px;
        }

        /* ── Overlay ── */
        .reviews-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.75);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0;
        }
        @media (min-width: 640px) {
          .reviews-overlay {
            align-items: center;
            padding: 24px;
          }
        }

        /* ── Panel ── */
        .reviews-panel {
          background: #0f1014;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 20px 20px 0 0;
          width: 100%;
          max-width: 640px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        @media (min-width: 640px) {
          .reviews-panel {
            border-radius: 20px;
            max-height: 80vh;
          }
        }

        .reviews-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 20px 14px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          flex-shrink: 0;
        }
        .reviews-panel-title {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 2px;
        }
        .reviews-panel-sub {
          font-size: 13px;
          color: rgba(255,255,255,.4);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 280px;
        }
        .reviews-close {
          background: none;
          border: none;
          color: rgba(255,255,255,.5);
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          margin-top: 2px;
        }
        .reviews-close:hover { color: #fff; }

        .reviews-panel-body {
          overflow-y: auto;
          padding: 12px 16px 24px;
          flex: 1;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,.15) transparent;
        }

        /* ── Loading ── */
        .reviews-loading {
          display: flex;
          justify-content: center;
          padding: 48px 0;
        }
        .reviews-spinner {
          width: 28px; height: 28px;
          border: 3px solid rgba(168,85,247,.3);
          border-top-color: #a855f7;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .reviews-empty {
          text-align: center;
          color: rgba(255,255,255,.3);
          font-size: 14px;
          padding: 48px 0;
        }

        /* ── Review card ── */
        .review-card {
          padding: 16px 0;
          border-bottom: 1px solid rgba(255,255,255,.07);
        }
        .review-card:last-child { border-bottom: none; }

        .review-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 10px;
        }

        /* Avatar */
        .review-avatar {
          width: 40px; height: 40px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          border: 2px solid rgba(255,255,255,.1);
        }
        .review-avatar-initials {
          background: linear-gradient(135deg,#7c3aed,#a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
        }

        .review-meta {
          flex: 1;
          min-width: 0;
        }
        .review-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .review-username {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
        }
        .review-handle {
          font-size: 12px;
          color: rgba(255,255,255,.35);
        }

        /* Verified badge */
        .review-badge {
          font-size: 10px;
          font-weight: 700;
          color: #a855f7;
          background: rgba(168,85,247,.15);
          border: 1px solid rgba(168,85,247,.3);
          border-radius: 10px;
          padding: 1px 7px;
          letter-spacing: .3px;
        }

        /* Rating block */
        .review-rating-block {
          flex-shrink: 0;
        }
        .review-stars {
          display: flex;
          align-items: center;
          gap: 1px;
        }
        .star { font-size: 13px; }
        .star-full  { color: #f59e0b; }
        .star-half  { color: #f59e0b; }
        .star-empty { color: rgba(255,255,255,.2); }
        .review-rating-num {
          font-size: 11px;
          color: rgba(255,255,255,.4);
          margin-left: 5px;
          font-variant-numeric: tabular-nums;
        }

        /* Body */
        .review-body {
          font-size: 14px;
          color: rgba(255,255,255,.85);
          line-height: 1.55;
          margin: 0 0 10px;
          word-break: break-word;
        }

        /* Footer */
        .review-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .review-date {
          font-size: 11px;
          color: rgba(255,255,255,.25);
        }
        .review-likes {
          font-size: 11px;
          color: rgba(255,255,255,.3);
        }
      `}</style>
    </>
  );
}
