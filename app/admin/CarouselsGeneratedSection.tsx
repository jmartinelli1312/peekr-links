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

interface ArticleLite {
  id: number;
  title: string;
  slug: string;
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

export default function CarouselsGeneratedSection({
  supabase,
  articleIds,
  onChanged,
}: {
  supabase: SupabaseClient;
  /** IDs of the day's ES published articles whose carousels we surface. */
  articleIds: number[];
  /** Called whenever a carousel changes — lets the parent refresh its data. */
  onChanged?: () => void;
}) {
  const [carousels, setCarousels] = useState<CarouselRow[]>([]);
  const [articleById, setArticleById] = useState<Record<number, ArticleLite>>({});
  const [igStatusById, setIgStatusById] = useState<Record<number, IgQueueStatus>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<null | "approve" | "regen" | "skip" | "download">(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (articleIds.length === 0) {
      setCarousels([]);
      setArticleById({});
      setIgStatusById({});
      return;
    }
    setLoading(true);
    setError("");

    // Latest non-discarded carousel per article. We pull all rows where
    // article_id ∈ articleIds and status ≠ 'discarded', then keep the highest
    // version per article. Simpler than a window function and cheap given
    // we expect at most a few rows per day.
    const { data: rows, error: cErr } = await supabase
      .from("peekrbuzz_carousels")
      .select(
        "id, article_id, version, status, category, category_emoji, title, thesis, cta, slides, caption, hashtags, mood, palette, ig_queue_id, generated_by, created_at, updated_at",
      )
      .in("article_id", articleIds)
      .neq("status", "discarded")
      .order("version", { ascending: false });

    if (cErr) {
      setError(cErr.message);
      setLoading(false);
      return;
    }

    const seen = new Set<number>();
    const latest: CarouselRow[] = [];
    for (const r of (rows ?? []) as CarouselRow[]) {
      if (seen.has(r.article_id)) continue;
      seen.add(r.article_id);
      latest.push(r);
    }
    setCarousels(latest);

    // Article lite info (title + slug for the article link)
    const { data: arts } = await supabase
      .from("peekrbuzz_articles")
      .select("id, title, slug")
      .in("id", articleIds);
    const ab: Record<number, ArticleLite> = {};
    for (const a of (arts ?? []) as ArticleLite[]) ab[a.id] = a;
    setArticleById(ab);

    // IG queue status per carousel that has an ig_queue_id
    const queueIds = latest.map((c) => c.ig_queue_id).filter((v): v is string => !!v);
    if (queueIds.length > 0) {
      const { data: qs } = await supabase
        .from("peekrbuzz_ig_queue")
        .select("id, status, published_at, ig_media_id, facebook_post_id, threads_post_id, bluesky_post_uri, error")
        .in("id", queueIds);

      const byCarousel: Record<number, IgQueueStatus> = {};
      for (const c of latest) {
        if (!c.ig_queue_id) continue;
        const q = (qs as Array<IgQueueStatus & { id: string }> | null)?.find((x) => x.id === c.ig_queue_id);
        if (q) byCarousel[c.id] = q;
      }
      setIgStatusById(byCarousel);
    } else {
      setIgStatusById({});
    }

    setLoading(false);
  }, [supabase, articleIds]);

  useEffect(() => {
    void load();
  }, [load]);

  async function authedFetch(path: string, method: "POST" | "GET", body?: object): Promise<Response> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No active session");
    return fetch(path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async function approve(c: CarouselRow) {
    if (!confirm("¿Renderear los 10 slides, subir a Storage y publicar a IG/FB/Threads ahora?")) return;
    setBusyId(c.id); setBusyAction("approve"); setError(""); setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/carousels/approve", "POST", { carousel_id: c.id });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ig_queue_id?: string };
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else {
        setInfo(`Carrusel aprobado y en cola. Publicación en curso.`);
        await load();
        onChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error aprobando");
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function regenerate(c: CarouselRow) {
    setBusyId(c.id); setBusyAction("regen"); setError(""); setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/carousels/regenerate", "POST", { carousel_id: c.id });
      const data = (await res.json().catch(() => ({}))) as { error?: string; version?: number };
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else {
        setInfo(`Carrusel v${data.version} generado`);
        await load();
        onChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error regenerando");
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function skip(c: CarouselRow) {
    if (!confirm("¿Marcar este carrusel como 'no publicar'? Podés volver a generar otro después.")) return;
    setBusyId(c.id); setBusyAction("skip"); setError(""); setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/carousels/skip", "POST", { carousel_id: c.id });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else {
        setInfo("Carrusel marcado como 'no publicar'");
        await load();
        onChanged?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al saltar");
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function downloadZip(c: CarouselRow) {
    setBusyId(c.id); setBusyAction("download"); setError(""); setInfo("");
    try {
      const res = await authedFetch(
        `/api/admin/peekrbuzz/carousels/download?carousel_id=${c.id}`,
        "GET",
      );
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        setError(errJson.error ?? `HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `peekr-carousel-${c.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after a tick so the download has time to start.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setInfo("ZIP descargado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error descargando");
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  // ── Slide preview URL ────────────────────────────────────────────────────
  function buildSlidePreviewUrl(c: CarouselRow, s: CarouselSlide): string {
    const palette = c.palette ?? {};
    const p = new URLSearchParams();
    p.set("kind", s.kind);
    p.set("n", String(s.n));
    p.set("total", String(c.slides.length || 10));
    p.set("headline", s.headline.slice(0, 200));
    if (s.body) p.set("body", s.body.slice(0, 280));
    if (s.image_url) p.set("img", s.image_url);
    p.set("category", c.category ?? "PEEKRBUZZ");
    p.set("emoji", c.category_emoji ?? "🎬");
    p.set("palette_p",  palette.primary   ?? "#FA0082");
    p.set("palette_s",  palette.secondary ?? "#6B0035");
    p.set("palette_a",  palette.accent    ?? "#FFC8E2");
    p.set("palette_bg", palette.bg        ?? "#0B0610");
    return `/api/buzz-carousel-slide?${p.toString()}`;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="cg-section">
      <style>{`
        .cg-section { display: flex; flex-direction: column; gap: 18px; margin-top: 36px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.08); }
        .cg-head { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; flex-wrap: wrap; }
        .cg-head h2 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
        .cg-sub { color: rgba(255,255,255,0.55); font-size: 13px; margin: 0; }

        .cg-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }
        .cg-card.draft     { border-color: rgba(245,158,11,0.3); }
        .cg-card.approved  { border-color: rgba(34,197,94,0.3); }
        .cg-card.published { border-color: rgba(34,197,94,0.5); background: rgba(34,197,94,0.04); }
        .cg-card.failed    { border-color: rgba(239,68,68,0.4); }
        .cg-card.skipped   { opacity: 0.6; }

        .cg-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .cg-card-title { display: flex; flex-direction: column; gap: 4px; }
        .cg-art-link { font-size: 11px; color: rgba(255,255,255,0.5); text-decoration: none; letter-spacing: 0.04em; text-transform: uppercase; font-weight: 700; }
        .cg-art-link:hover { color: #ffc8e2; }
        .cg-title { font-size: 18px; font-weight: 800; margin: 0; color: white; line-height: 1.25; }
        .cg-meta-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11px; color: rgba(255,255,255,0.55); }
        .cg-chip { padding: 3px 9px; border-radius: 999px; font-weight: 800; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid; }
        .cg-chip.cat { color: white; background: rgba(250,0,130,0.18); border-color: rgba(250,0,130,0.45); }
        .cg-chip.status.draft     { color: #fcd34d; background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.4); }
        .cg-chip.status.approved  { color: #86efac; background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.4); }
        .cg-chip.status.published { color: #4ade80; background: rgba(34,197,94,0.22); border-color: rgba(34,197,94,0.55); }
        .cg-chip.status.failed    { color: #fca5a5; background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); }
        .cg-chip.status.skipped   { color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); }

        .cg-slides-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        @media (max-width: 800px) { .cg-slides-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 480px) { .cg-slides-grid { grid-template-columns: repeat(2, 1fr); } }
        .cg-slide { position: relative; aspect-ratio: 1080 / 1350; background: #000; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); }
        .cg-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cg-slide-number { position: absolute; top: 4px; left: 4px; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.65); color: white; font-size: 10px; font-weight: 800; letter-spacing: 0.04em; backdrop-filter: blur(4px); }

        .cg-caption { padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; }
        .cg-caption-label { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
        .cg-caption-body { font-size: 12px; color: rgba(255,255,255,0.8); line-height: 1.5; white-space: pre-wrap; max-height: 140px; overflow: auto; }

        .cg-actions { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 4px; }
        .cg-btn { padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid; transition: opacity 0.12s; }
        .cg-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .cg-btn.approve  { background: #22c55e; border-color: #22c55e; color: #052e16; }
        .cg-btn.download { background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.6); color: #c7d2fe; }
        .cg-btn.regen    { background: transparent; border-color: rgba(245,158,11,0.55); color: #fcd34d; }
        .cg-btn.skip     { background: transparent; border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.55); }

        .cg-status-line { font-size: 12px; padding: 8px 12px; border-radius: 8px; }
        .cg-status-line.info    { color: #67e8f9; background: rgba(6,182,212,0.1);  border: 1px solid rgba(6,182,212,0.3); }
        .cg-status-line.success { color: #86efac; background: rgba(34,197,94,0.1);  border: 1px solid rgba(34,197,94,0.3); }
        .cg-status-line.error   { color: #fca5a5; background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.3); }

        .cg-empty { padding: 36px 20px; text-align: center; color: rgba(255,255,255,0.5); font-size: 13px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px; }
      `}</style>

      <div className="cg-head">
        <div>
          <h2>📸 Carruseles generados</h2>
          <p className="cg-sub">
            10 slides cinematográficos por artículo publicado. Descargá el ZIP para subir a TikTok o aprobá para publicar en IG/FB/Threads.
          </p>
        </div>
      </div>

      {error && <div className="cg-status-line error">⚠ {error}</div>}
      {info && <div className="cg-status-line success">{info}</div>}

      {loading ? (
        <div className="cg-empty">Cargando carruseles…</div>
      ) : carousels.length === 0 ? (
        <div className="cg-empty">
          Aún no se generó ningún carrusel para los artículos publicados hoy.
          <br />
          Apretá <strong>Generar carrusel</strong> en el card de cada artículo de arriba.
        </div>
      ) : (
        carousels.map((c) => {
          const art = articleById[c.article_id];
          const ig = igStatusById[c.id];
          const isBusy = busyId === c.id;

          return (
            <div key={c.id} className={`cg-card ${c.status}`}>
              <div className="cg-card-head">
                <div className="cg-card-title">
                  {art && (
                    <a
                      href={`/es/buzz/${art.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="cg-art-link"
                      title="Ver artículo"
                    >
                      {art.title} ↗
                    </a>
                  )}
                  <h3 className="cg-title">{c.title ?? "Carrusel"}</h3>
                  <div className="cg-meta-row">
                    {c.category && (
                      <span className="cg-chip cat">
                        {c.category_emoji ?? "🎬"} {c.category}
                      </span>
                    )}
                    <span className={`cg-chip status ${c.status}`}>{c.status}</span>
                    <span>· v{c.version}</span>
                    {c.mood && <span>· {c.mood.slice(0, 40)}</span>}
                    {ig?.ig_media_id && (
                      <a
                        href={`https://www.instagram.com/p/${ig.ig_media_id}/`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#86efac", textDecoration: "none" }}
                      >
                        · ver en IG ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="cg-slides-grid">
                {c.slides.map((s) => (
                  <div key={s.n} className="cg-slide">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={buildSlidePreviewUrl(c, s)}
                      alt={`${c.title ?? "Carrusel"} — slide ${s.n}`}
                      loading="lazy"
                    />
                    <span className="cg-slide-number">{s.n}/{c.slides.length}</span>
                  </div>
                ))}
              </div>

              {c.caption && (
                <div className="cg-caption">
                  <div className="cg-caption-label">Caption Instagram (incluida en ZIP como caption.txt)</div>
                  <div className="cg-caption-body">{c.caption}</div>
                </div>
              )}

              <div className="cg-actions">
                <button
                  className="cg-btn download"
                  onClick={() => downloadZip(c)}
                  disabled={isBusy}
                  title="Descarga un ZIP con slide-01.png … slide-10.png + caption.txt"
                >
                  {isBusy && busyAction === "download" ? "Empaquetando…" : "⬇ Descargar todos (ZIP)"}
                </button>

                {c.status === "draft" && (
                  <>
                    <button
                      className="cg-btn approve"
                      onClick={() => approve(c)}
                      disabled={isBusy}
                      title="Publica en IG/FB/Threads usando social_publisher"
                    >
                      {isBusy && busyAction === "approve" ? "Publicando…" : "✓ Publicar en IG/FB"}
                    </button>
                    <button
                      className="cg-btn regen"
                      onClick={() => regenerate(c)}
                      disabled={isBusy}
                      title="Descarta este y genera otra versión"
                    >
                      {isBusy && busyAction === "regen" ? "Regenerando…" : "↻ Regenerar"}
                    </button>
                    <button
                      className="cg-btn skip"
                      onClick={() => skip(c)}
                      disabled={isBusy}
                      title="Marcar como no publicar"
                    >
                      {isBusy && busyAction === "skip" ? "…" : "No publicar"}
                    </button>
                  </>
                )}

                {c.status === "approved" && ig && ig.status !== "published" && (
                  <span className="cg-status-line info">
                    En cola para publicación ({ig.status}). Refrescá en ~1 min para ver el media ID.
                  </span>
                )}
                {c.status === "published" && ig?.published_at && (
                  <span className="cg-status-line success">
                    Publicado {new Date(ig.published_at).toLocaleString("es-AR")}
                    {ig.facebook_post_id && " · FB ✓"}
                    {ig.threads_post_id && " · Threads ✓"}
                    {ig.bluesky_post_uri && " · Bluesky ✓"}
                  </span>
                )}
                {(c.status === "failed" || ig?.status === "failed") && (
                  <span className="cg-status-line error">
                    Falló: {ig?.error ?? "ver logs de social_publisher"}
                  </span>
                )}
                {c.status === "skipped" && (
                  <button
                    className="cg-btn regen"
                    onClick={() => regenerate(c)}
                    disabled={isBusy}
                  >
                    {isBusy && busyAction === "regen" ? "Generando…" : "↻ Generar otra versión"}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
