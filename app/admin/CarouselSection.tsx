"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CarouselSlide {
  n: number;
  kind: "hook" | "body" | "thesis";
  headline: string;
  body: string | null;
  image_url: string | null;
  image_credit?: string | null;
}

interface CarouselRow {
  id: number;
  article_id: number;
  version: number;
  status: "draft" | "discarded" | "skipped" | "approved" | "published" | "failed";
  category: string | null;
  category_emoji: string | null;
  title: string | null;
  thesis: string | null;
  cta: string | null;
  slides: CarouselSlide[];
  caption: string | null;
  hashtags: string | null;
  mood: string | null;
  palette: { primary?: string; secondary?: string; accent?: string; bg?: string } | null;
  ig_queue_id: string | null;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface IgQueueStatus {
  status: string | null;
  published_at: string | null;
  ig_media_id: string | null;
  facebook_post_id: string | null;
  threads_post_id: string | null;
  bluesky_post_uri: string | null;
  error: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ACTION_COLORS = {
  approve: "#22c55e",
  regen: "#f59e0b",
  skip: "rgba(255,255,255,0.15)",
};

export default function CarouselSection({
  supabase,
  articleId,
}: {
  supabase: SupabaseClient;
  articleId: number;
}) {
  const [carousel, setCarousel] = useState<CarouselRow | null>(null);
  const [igStatus, setIgStatus] = useState<IgQueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "generating" | "regenerating" | "approving" | "skipping">(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [activeSlide, setActiveSlide] = useState(1);

  // ── Load latest carousel for this article ─────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchErr } = await supabase
      .from("peekrbuzz_carousels")
      .select(
        "id, article_id, version, status, category, category_emoji, title, thesis, cta, slides, caption, hashtags, mood, palette, ig_queue_id, generated_by, created_at, updated_at",
      )
      .eq("article_id", articleId)
      .order("version", { ascending: false })
      .limit(1);

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    const row = (data ?? [])[0] as CarouselRow | undefined;
    setCarousel(row ?? null);
    setActiveSlide(1);

    // If approved/published/failed, pull the IG queue row for status detail.
    if (row?.ig_queue_id) {
      const { data: q } = await supabase
        .from("peekrbuzz_ig_queue")
        .select("status, published_at, ig_media_id, facebook_post_id, threads_post_id, bluesky_post_uri, error")
        .eq("id", row.ig_queue_id)
        .maybeSingle();
      setIgStatus((q as IgQueueStatus | null) ?? null);
    } else {
      setIgStatus(null);
    }

    setLoading(false);
  }, [supabase, articleId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Auth token helper ─────────────────────────────────────────────────────
  async function authedFetch(path: string, body: object): Promise<Response> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No active session");
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function generate() {
    setBusy("generating");
    setError("");
    setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/carousels/generate", { article_id: articleId });
      const data = (await res.json().catch(() => ({}))) as { error?: string; carousel_id?: number; version?: number };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setInfo(`Carrusel v${data.version} generado`);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando");
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    if (!carousel) return;
    setBusy("regenerating");
    setError("");
    setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/carousels/regenerate", { carousel_id: carousel.id });
      const data = (await res.json().catch(() => ({}))) as { error?: string; version?: number };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setInfo(`Carrusel v${data.version} generado`);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error regenerando");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!carousel) return;
    if (!confirm("¿Renderear los 10 slides, subir a Storage y publicar a IG/FB/Threads ahora?")) return;
    setBusy("approving");
    setError("");
    setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/carousels/approve", { carousel_id: carousel.id });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ig_queue_id?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setInfo(`Carrusel aprobado y en cola (ig_queue_id=${data.ig_queue_id?.slice(0, 8)}…). Publicación en curso.`);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error aprobando");
    } finally {
      setBusy(null);
    }
  }

  async function skip() {
    if (!carousel) return;
    if (!confirm("¿Marcar este carrusel como 'no publicar'? Podés volver a generar otro después.")) return;
    setBusy("skipping");
    setError("");
    setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/carousels/skip", { carousel_id: carousel.id });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setInfo("Carrusel marcado como 'no publicar'");
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al saltar");
    } finally {
      setBusy(null);
    }
  }

  // ── Slide preview URL builder ─────────────────────────────────────────────
  function buildSlidePreviewUrl(s: CarouselSlide): string {
    if (!carousel) return "";
    const palette = carousel.palette ?? {};
    const p = new URLSearchParams();
    p.set("kind", s.kind);
    p.set("n", String(s.n));
    p.set("total", "10");
    p.set("headline", s.headline.slice(0, 200));
    if (s.body) p.set("body", s.body.slice(0, 280));
    if (s.image_url) p.set("img", s.image_url);
    p.set("category", carousel.category ?? "PEEKRBUZZ");
    p.set("emoji", carousel.category_emoji ?? "🎬");
    p.set("palette_p",  palette.primary   ?? "#FA0082");
    p.set("palette_s",  palette.secondary ?? "#6B0035");
    p.set("palette_a",  palette.accent    ?? "#FFC8E2");
    p.set("palette_bg", palette.bg        ?? "#0B0610");
    return `/api/buzz-carousel-slide?${p.toString()}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="carousel-wrap">
      <style>{`
        .carousel-wrap { margin-top: 16px; padding-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); }
        .carousel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
        .carousel-head h4 { margin: 0; font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.85); letter-spacing: 0.04em; text-transform: uppercase; }
        .carousel-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 11px; color: rgba(255,255,255,0.5); }
        .carousel-badge { padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
        .carousel-badge.draft { background: rgba(245,158,11,0.15); color: #fcd34d; border: 1px solid rgba(245,158,11,0.35); }
        .carousel-badge.approved { background: rgba(34,197,94,0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.35); }
        .carousel-badge.published { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid rgba(34,197,94,0.5); }
        .carousel-badge.skipped { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.1); }
        .carousel-badge.failed { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.35); }

        .carousel-slider { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .carousel-main { position: relative; width: 100%; aspect-ratio: 1080 / 1350; background: #000; border-radius: 10px; overflow: hidden; }
        .carousel-main img { width: 100%; height: 100%; object-fit: contain; background: #000; }
        .carousel-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; width: 32px; height: 32px; border-radius: 999px; cursor: pointer; font-size: 18px; line-height: 1; backdrop-filter: blur(4px); }
        .carousel-nav.prev { left: 8px; }
        .carousel-nav.next { right: 8px; }
        .carousel-nav:hover { background: rgba(0,0,0,0.75); }
        .carousel-nav:disabled { opacity: 0.3; cursor: default; }

        .carousel-thumbs { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px; }
        .carousel-thumb { flex: 0 0 auto; width: 48px; aspect-ratio: 1080 / 1350; border-radius: 4px; overflow: hidden; cursor: pointer; opacity: 0.55; border: 2px solid transparent; transition: opacity 0.12s, border-color 0.12s; background: #000; }
        .carousel-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .carousel-thumb.active { opacity: 1; border-color: #FA0082; }
        .carousel-thumb:hover { opacity: 0.85; }

        .carousel-caption-wrap { margin-top: 10px; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; }
        .carousel-caption-label { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.45); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
        .carousel-caption-body { font-size: 12px; color: rgba(255,255,255,0.78); line-height: 1.45; white-space: pre-wrap; max-height: 120px; overflow: auto; }

        .carousel-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
        .carousel-btn { padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; border: 1px solid; cursor: pointer; transition: opacity 0.12s; }
        .carousel-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .carousel-btn.approve { background: ${ACTION_COLORS.approve}; border-color: ${ACTION_COLORS.approve}; color: #052e16; }
        .carousel-btn.regen { background: transparent; border-color: rgba(245,158,11,0.55); color: #fcd34d; }
        .carousel-btn.skip { background: transparent; border-color: ${ACTION_COLORS.skip}; color: rgba(255,255,255,0.55); }
        .carousel-btn.generate { background: #FA0082; border-color: #FA0082; color: white; }

        .carousel-empty { padding: 12px 14px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; font-size: 12px; color: rgba(255,255,255,0.5); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .carousel-mini-error { font-size: 11px; color: #fca5a5; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; padding: 6px 10px; margin-top: 8px; }
        .carousel-mini-info { font-size: 11px; color: #86efac; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.3); border-radius: 6px; padding: 6px 10px; margin-top: 8px; }
        .carousel-ig-link { font-size: 11px; color: #86efac; text-decoration: none; }
        .carousel-ig-link:hover { color: #4ade80; }
      `}</style>

      <div className="carousel-head">
        <h4>Carrusel IG/FB</h4>
        {carousel && (
          <div className="carousel-meta">
            <span className={`carousel-badge ${carousel.status}`}>{carousel.status}</span>
            <span>v{carousel.version}</span>
            {carousel.category && <span>· {carousel.category}</span>}
            {carousel.mood && <span>· {carousel.mood.slice(0, 28)}</span>}
            {igStatus?.ig_media_id && (
              <a
                className="carousel-ig-link"
                href={`https://www.instagram.com/p/${igStatus.ig_media_id}/`}
                target="_blank"
                rel="noreferrer"
              >
                · ver en IG ↗
              </a>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="carousel-empty">Cargando…</div>
      ) : !carousel ? (
        <div className="carousel-empty">
          <span>Aún no se generó carrusel para este artículo.</span>
          <button
            className="carousel-btn generate"
            onClick={generate}
            disabled={busy !== null}
          >
            {busy === "generating" ? "Generando…" : "Generar carrusel"}
          </button>
        </div>
      ) : (
        <>
          <div className="carousel-slider">
            <div className="carousel-main">
              {carousel.slides[activeSlide - 1] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${carousel.id}-${activeSlide}`}
                  src={buildSlidePreviewUrl(carousel.slides[activeSlide - 1])}
                  alt={`Slide ${activeSlide}`}
                  loading="lazy"
                />
              )}
              <button
                className="carousel-nav prev"
                disabled={activeSlide <= 1}
                onClick={() => setActiveSlide((n) => Math.max(1, n - 1))}
                aria-label="Slide anterior"
              >
                ‹
              </button>
              <button
                className="carousel-nav next"
                disabled={activeSlide >= 10}
                onClick={() => setActiveSlide((n) => Math.min(10, n + 1))}
                aria-label="Slide siguiente"
              >
                ›
              </button>
            </div>

            <div className="carousel-thumbs">
              {carousel.slides.map((s) => (
                <div
                  key={s.n}
                  className={`carousel-thumb${activeSlide === s.n ? " active" : ""}`}
                  onClick={() => setActiveSlide(s.n)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={buildSlidePreviewUrl(s)} alt={`Slide ${s.n}`} loading="lazy" />
                </div>
              ))}
            </div>
          </div>

          {carousel.caption && (
            <div className="carousel-caption-wrap">
              <div className="carousel-caption-label">Caption Instagram</div>
              <div className="carousel-caption-body">{carousel.caption}</div>
            </div>
          )}

          {carousel.status === "draft" && (
            <div className="carousel-actions">
              <button
                className="carousel-btn approve"
                onClick={approve}
                disabled={busy !== null}
                title="Renderea, sube y publica en IG/FB/Threads"
              >
                {busy === "approving" ? "Publicando…" : "✓ Aprobar y publicar"}
              </button>
              <button
                className="carousel-btn regen"
                onClick={regenerate}
                disabled={busy !== null}
                title="Genera una nueva versión y descarta esta"
              >
                {busy === "regenerating" ? "Regenerando…" : "↻ Regenerar"}
              </button>
              <button
                className="carousel-btn skip"
                onClick={skip}
                disabled={busy !== null}
                title="No publicar este carrusel"
              >
                {busy === "skipping" ? "…" : "No publicar"}
              </button>
            </div>
          )}

          {carousel.status === "approved" && igStatus?.status && igStatus.status !== "published" && (
            <div className="carousel-mini-info">
              En cola para publicación ({igStatus.status}). Refrescá en ~1 min para ver el ID de IG.
            </div>
          )}
          {carousel.status === "published" && igStatus?.published_at && (
            <div className="carousel-mini-info">
              Publicado {new Date(igStatus.published_at).toLocaleString("es-AR")}
              {igStatus.facebook_post_id && " · FB ✓"}
              {igStatus.threads_post_id && " · Threads ✓"}
              {igStatus.bluesky_post_uri && " · Bluesky ✓"}
            </div>
          )}
          {(carousel.status === "failed" || igStatus?.status === "failed") && (
            <div className="carousel-mini-error">
              Falló: {igStatus?.error ?? "ver logs de social_publisher"}
            </div>
          )}
          {carousel.status === "skipped" && (
            <div className="carousel-actions">
              <button
                className="carousel-btn generate"
                onClick={generate}
                disabled={busy !== null}
              >
                {busy === "generating" ? "Generando…" : "Generar otra versión"}
              </button>
            </div>
          )}
        </>
      )}

      {error && <div className="carousel-mini-error">⚠ {error}</div>}
      {info && <div className="carousel-mini-info">{info}</div>}
    </div>
  );
}
