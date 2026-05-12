"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dedicated section for the Thursday weekend-reco carousel pipeline.
 *
 * Reads from peekrbuzz_ig_queue (draft_type='weekend_reco') — these are the
 * 6-slide drafts (1 hook + 4 movie/TV cards + 1 CTA) produced by the
 * weekly_reco_for_admin edge function and pre-rendered by render_single_slide.
 *
 * Slides are already public PNGs in Supabase Storage (slide_urls column), so
 * unlike the cinematic carousels there's no render-on-approve step — Aprobar
 * just flips status to 'approved' + scheduled_for=now() and the social_publisher
 * picks them up.
 */

interface DraftRow {
  id: string;
  draft_type: string | null;
  hook_text: string | null;
  caption: string | null;
  article_url: string | null;
  slide_urls: string[] | null;
  status: string | null;
  ig_media_id: string | null;
  threads_post_id: string | null;
  published_at: string | null;
  scheduled_for: string | null;
  error: string | null;
  generated_at: string | null;
  seed_title: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Para revisar",
  pending_approval: "Para revisar",
  approved: "En cola",
  published: "Publicado",
  failed: "Falló",
  rejected: "Descartado",
};

export default function WeekendRecoSection({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<null | "approve" | "skip" | "download" | "generate">(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Detect Web Share API support for "save to gallery" — same probe used by
  // CarouselsGeneratedSection.
  const [canShareImages, setCanShareImages] = useState<boolean>(false);
  useEffect(() => {
    if (typeof navigator === "undefined" || !("canShare" in navigator)) return;
    try {
      const probe = new File([new Blob(["x"], { type: "image/png" })], "p.png", { type: "image/png" });
      setCanShareImages(navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareImages(false);
    }
  }, []);

  // ── Load last 14 days of weekend_reco drafts ─────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data, error: fErr } = await supabase
      .from("peekrbuzz_ig_queue")
      .select(
        "id, draft_type, hook_text, caption, article_url, slide_urls, status, ig_media_id, threads_post_id, published_at, scheduled_for, error, generated_at, seed_title",
      )
      .eq("draft_type", "weekend_reco")
      .gte("generated_at", since)
      .order("generated_at", { ascending: false });

    if (fErr) {
      setError(fErr.message);
      setLoading(false);
      return;
    }
    setDrafts((data ?? []) as DraftRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function authedFetch(path: string, method: "POST" | "GET", body?: object): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No active session");
    return fetch(path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async function generateNow() {
    if (!confirm("¿Generar un carrusel del finde nuevo ahora? (Toma ~60-90s)")) return;
    setBusyId("__new__"); setBusyAction("generate"); setError(""); setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/weekend-reco/generate", "POST", {});
      const data = (await res.json().catch(() => ({}))) as { error?: string; draft_id?: string; hook?: string };
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else {
        setInfo(`Carrusel generado: "${data.hook ?? "ok"}"`);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando");
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function approve(d: DraftRow) {
    if (!confirm("¿Publicar este carrusel en IG y Threads ahora?")) return;
    setBusyId(d.id); setBusyAction("approve"); setError(""); setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/ig-queue/approve", "POST", { draft_id: d.id });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else {
        setInfo("Aprobado y en cola — refrescá en ~1 min para ver el media ID");
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error aprobando");
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function skip(d: DraftRow) {
    if (!confirm("¿Descartar este carrusel del finde?")) return;
    setBusyId(d.id); setBusyAction("skip"); setError(""); setInfo("");
    try {
      const res = await authedFetch("/api/admin/peekrbuzz/ig-queue/skip", "POST", { draft_id: d.id });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else {
        setInfo("Carrusel descartado");
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error descartando");
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  async function saveSlides(d: DraftRow) {
    setBusyId(d.id); setBusyAction("download"); setError(""); setInfo("");
    try {
      const urls = d.slide_urls ?? [];
      if (urls.length === 0) {
        setError("este draft no tiene slide_urls aún — esperá a que termine de renderear");
        return;
      }

      if (canShareImages) {
        const files = await Promise.all(
          urls.map(async (url, i) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`slide ${i + 1}: HTTP ${res.status}`);
            const blob = await res.blob();
            return new File([blob], `peekr-finde-slide-${String(i + 1).padStart(2, "0")}.png`, { type: "image/png" });
          }),
        );
        if (typeof navigator !== "undefined" && navigator.canShare?.({ files })) {
          try {
            await navigator.share({ files, title: `Recomendaciones del finde — Peekr` });
            if (d.caption && navigator.clipboard?.writeText) {
              try { await navigator.clipboard.writeText(d.caption); } catch { /* ignore */ }
            }
            setInfo("Compartido — guardá las imágenes en la galería desde el menú. Caption copiada al portapapeles.");
            return;
          } catch (err) {
            if ((err as Error)?.name === "AbortError") return;
            console.warn("Web Share failed:", err);
          }
        }
      }

      // Fallback: trigger one anchor download per slide. Browsers stagger them.
      for (let i = 0; i < urls.length; i++) {
        const a = document.createElement("a");
        a.href = urls[i];
        a.download = `peekr-finde-slide-${String(i + 1).padStart(2, "0")}.png`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 250));
      }
      setInfo("Descarga iniciada — revisá tu carpeta de descargas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error descargando");
    } finally {
      setBusyId(null); setBusyAction(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="wr-section">
      <style>{`
        .wr-section { display: flex; flex-direction: column; gap: 18px; margin-top: 36px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.08); }
        .wr-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .wr-head-text h2 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
        .wr-sub { color: rgba(255,255,255,0.55); font-size: 13px; margin: 4px 0 0 0; max-width: 720px; }

        .wr-trigger { padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; border: 1px solid; background: linear-gradient(135deg, #FA0082 0%, #8A2BE2 100%); border-color: #FA0082; color: white; box-shadow: 0 4px 16px rgba(250,0,130,0.3); }
        .wr-trigger:disabled { opacity: 0.5; cursor: not-allowed; }

        .wr-card { background: linear-gradient(135deg, rgba(250,0,130,0.06) 0%, rgba(138,43,226,0.06) 100%); border: 1px solid rgba(250,0,130,0.22); border-radius: 16px; padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }
        .wr-card.published { border-color: rgba(34,197,94,0.5); }
        .wr-card.failed    { border-color: rgba(239,68,68,0.4); }
        .wr-card.rejected  { opacity: 0.5; }

        .wr-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .wr-card-title { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .wr-hook { font-size: 17px; font-weight: 800; color: white; line-height: 1.3; margin: 0; }
        .wr-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11px; color: rgba(255,255,255,0.55); }
        .wr-chip { padding: 3px 9px; border-radius: 999px; font-weight: 800; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid; }
        .wr-chip.kind { color: white; background: linear-gradient(135deg, #FA0082 0%, #8A2BE2 100%); border-color: transparent; }
        .wr-chip.status.pending_review,
        .wr-chip.status.pending_approval { color: #fcd34d; background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.4); }
        .wr-chip.status.approved  { color: #86efac; background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.4); }
        .wr-chip.status.published { color: #4ade80; background: rgba(34,197,94,0.22); border-color: rgba(34,197,94,0.55); }
        .wr-chip.status.failed    { color: #fca5a5; background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); }
        .wr-chip.status.rejected  { color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); }

        .wr-slides { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
        @media (max-width: 800px) { .wr-slides { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 480px) { .wr-slides { grid-template-columns: repeat(2, 1fr); } }
        .wr-slide { position: relative; aspect-ratio: 1080 / 1350; background: #000; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); }
        .wr-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .wr-slide-num { position: absolute; top: 4px; left: 4px; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.65); color: white; font-size: 10px; font-weight: 800; backdrop-filter: blur(4px); }
        .wr-no-slides { padding: 26px; text-align: center; color: rgba(255,255,255,0.5); font-size: 13px; background: rgba(0,0,0,0.2); border-radius: 10px; border: 1px dashed rgba(255,255,255,0.1); }

        .wr-caption { padding: 12px 14px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; }
        .wr-caption-label { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
        .wr-caption-body { font-size: 12px; color: rgba(255,255,255,0.8); line-height: 1.5; white-space: pre-wrap; max-height: 140px; overflow: auto; }

        .wr-actions { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 4px; }
        .wr-btn { padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid; transition: opacity 0.12s; }
        .wr-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .wr-btn.approve  { background: #22c55e; border-color: #22c55e; color: #052e16; }
        .wr-btn.download { background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.6); color: #c7d2fe; }
        .wr-btn.skip     { background: transparent; border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.55); }

        .wr-status-line { font-size: 12px; padding: 8px 12px; border-radius: 8px; }
        .wr-status-line.info    { color: #67e8f9; background: rgba(6,182,212,0.1);  border: 1px solid rgba(6,182,212,0.3); }
        .wr-status-line.success { color: #86efac; background: rgba(34,197,94,0.1);  border: 1px solid rgba(34,197,94,0.3); }
        .wr-status-line.error   { color: #fca5a5; background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.3); }

        .wr-empty { padding: 36px 20px; text-align: center; color: rgba(255,255,255,0.5); font-size: 13px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(250,0,130,0.18); border-radius: 12px; }
      `}</style>

      <div className="wr-head">
        <div className="wr-head-text">
          <h2>🎬 Recomendaciones del finde</h2>
          <p className="wr-sub">
            Carrusel automático de 6 slides cada jueves 12:00 ART, basado en los títulos más vistos en Peekr esta semana.
            Va a IG y Threads cuando lo aprobás.
          </p>
        </div>
        <button
          className="wr-trigger"
          onClick={generateNow}
          disabled={busyId !== null}
          title="Genera ahora un nuevo carrusel del finde, sin esperar al cron del jueves"
        >
          {busyAction === "generate" ? "Generando…" : "+ Generar ahora"}
        </button>
      </div>

      {error && <div className="wr-status-line error">⚠ {error}</div>}
      {info && <div className="wr-status-line success">{info}</div>}

      {loading ? (
        <div className="wr-empty">Cargando…</div>
      ) : drafts.length === 0 ? (
        <div className="wr-empty">
          No hay carruseles del finde en los últimos 14 días.
          <br />
          El cron corre los jueves 15:00 UTC (12:00 ART) — o apretá <strong>Generar ahora</strong>.
        </div>
      ) : (
        drafts.map((d) => {
          const status = d.status ?? "pending_review";
          const slideUrls = d.slide_urls ?? [];
          const isBusy = busyId === d.id;
          const isPending = status === "pending_review" || status === "pending_approval";

          return (
            <div key={d.id} className={`wr-card ${status}`}>
              <div className="wr-card-head">
                <div className="wr-card-title">
                  <div className="wr-meta">
                    <span className="wr-chip kind">🎬 Recomendaciones del finde</span>
                    <span className={`wr-chip status ${status}`}>{STATUS_LABEL[status] ?? status}</span>
                    {d.generated_at && (
                      <span>· {new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d.generated_at))}</span>
                    )}
                    {d.ig_media_id && (
                      <a
                        href={`https://www.instagram.com/p/${d.ig_media_id}/`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#86efac", textDecoration: "none" }}
                      >
                        · ver en IG ↗
                      </a>
                    )}
                  </div>
                  {d.hook_text && <h3 className="wr-hook">{d.hook_text}</h3>}
                  {d.article_url && (
                    <a
                      href={d.article_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}
                    >
                      Artículo: {d.article_url.replace("https://www.peekr.app", "")} ↗
                    </a>
                  )}
                </div>
              </div>

              {slideUrls.length > 0 ? (
                <div className="wr-slides">
                  {slideUrls.map((url, i) => (
                    <div key={i} className="wr-slide">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Slide ${i + 1}`} loading="lazy" />
                      <span className="wr-slide-num">{i + 1}/{slideUrls.length}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="wr-no-slides">Slides aún no rendereadas — refrescá en unos segundos.</div>
              )}

              {d.caption && (
                <div className="wr-caption">
                  <div className="wr-caption-label">Caption Instagram</div>
                  <div className="wr-caption-body">{d.caption}</div>
                </div>
              )}

              <div className="wr-actions">
                {slideUrls.length > 0 && (
                  <button
                    className="wr-btn download"
                    onClick={() => saveSlides(d)}
                    disabled={isBusy}
                    title={canShareImages ? "Abre el menú compartir → tocá Guardar imágenes" : "Descarga cada slide al disco"}
                  >
                    {isBusy && busyAction === "download" ? "Preparando…" : (canShareImages ? "📥 Guardar en galería" : "⬇ Descargar slides")}
                  </button>
                )}

                {isPending && slideUrls.length >= 2 && (
                  <>
                    <button className="wr-btn approve" onClick={() => approve(d)} disabled={isBusy}>
                      {isBusy && busyAction === "approve" ? "Publicando…" : "✓ Publicar en IG/Threads"}
                    </button>
                    <button className="wr-btn skip" onClick={() => skip(d)} disabled={isBusy}>
                      {isBusy && busyAction === "skip" ? "…" : "Descartar"}
                    </button>
                  </>
                )}

                {status === "approved" && (
                  <span className="wr-status-line info">
                    En cola para publicación. Refrescá en ~1 min para ver el media ID.
                  </span>
                )}
                {status === "published" && d.published_at && (
                  <span className="wr-status-line success">
                    Publicado {new Date(d.published_at).toLocaleString("es-AR")}
                    {d.threads_post_id && " · Threads ✓"}
                  </span>
                )}
                {status === "failed" && (
                  <span className="wr-status-line error">
                    Falló: {d.error ?? "ver logs de social_publisher"}
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
