"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Editorial → Reels: spoiler-free title reels (trailer + ElevenLabs voice +
 * captions). Flow: Generar guion (auto-picks today's top Peekr title) →
 * review/edit → Renderizar (Railway worker) → preview → Enviar a IG (review
 * queue) — same approve→social_publisher path as the carousels.
 */

interface Beat { kind: string; headline: string; voice: string }
interface ReelScript { hook: string; beats: Beat[]; caption: string; hashtags: string }
interface ReelRow {
  id: string;
  tmdb_id: number;
  media_type: string;
  title: string | null;
  status: string;
  script: ReelScript | null;
  facts: { peekrRating?: number | null; peekrRatingCount?: number; platforms?: string[]; runtimeMin?: number | null; posterPath?: string | null } | null;
  trailer_youtube_key: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  caption: string | null;
  hashtags: string | null;
  ig_queue_id: string | null;
  error: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending_script: "Generando guion…",
  script_ready: "Guion listo",
  queued: "En cola de render",
  rendering: "Renderizando…",
  ready: "Video listo",
  failed: "Falló",
  published: "Publicado",
  discarded: "Descartado",
};

export default function ReelsSection({ supabase }: { supabase: SupabaseClient }) {
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [editing, setEditing] = useState<Record<string, ReelScript>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("title_reels")
      .select("*")
      .neq("status", "discarded")
      .order("created_at", { ascending: false })
      .limit(20);
    if (e) setError(e.message);
    else setReels((data ?? []) as ReelRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh while something is queued/rendering.
  useEffect(() => {
    if (!reels.some((r) => ["queued", "rendering", "pending_script"].includes(r.status))) return;
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [reels, load]);

  async function authed(path: string, body: object) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No active session");
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  async function createReel() {
    setBusy("__new__"); setError(""); setInfo("");
    try {
      const res = await authed("/api/admin/reels/create", {});
      const data = (await res.json().catch(() => ({}))) as { error?: string; title?: string };
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else { setInfo(`Guion generado para "${data.title}"`); await load(); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  async function act(r: ReelRow, action: string, extra: object = {}) {
    setBusy(r.id); setError(""); setInfo("");
    try {
      const res = await authed("/api/admin/reels/action", { id: r.id, action, ...extra });
      const data = (await res.json().catch(() => ({}))) as { error?: string; review?: string };
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else {
        setInfo(
          action === "render" ? "En cola — el worker lo renderiza en ~2-4 min" :
          action === "publish_ig" ? "Enviado a revisión IG (aprobalo en «Carruseles del finde»)" :
          action === "update_script" ? "Guion guardado" : "Listo",
        );
        if (action === "update_script") setEditing((m) => { const c = { ...m }; delete c[r.id]; return c; });
        await load();
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const btn = (bg: string, border: string, color: string): React.CSSProperties => ({
    background: bg, border: `1px solid ${border}`, color, borderRadius: 8,
    padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  });

  return (
    <section id="reels" style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🎬 Reels de títulos</h2>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            Trailer recortado 9:16 sin audio + voz ElevenLabs + subtítulos. Elige el título más activo en Peekr (7 días, sin repetir).
          </div>
        </div>
        <button style={btn("#CC0066", "#CC0066", "#fff")} onClick={createReel} disabled={busy !== null}>
          {busy === "__new__" ? "Generando guion…" : "✨ Generar reel de hoy"}
        </button>
      </div>

      {info && <div style={{ fontSize: 12.5, color: "#86efac", marginBottom: 8 }}>{info}</div>}
      {error && <div style={{ fontSize: 12.5, color: "#fca5a5", marginBottom: 8 }}>⚠ {error}</div>}
      {loading && reels.length === 0 && <div style={{ color: "rgba(255,255,255,0.5)" }}>Cargando…</div>}

      <div style={{ display: "grid", gap: 14 }}>
        {reels.map((r) => {
          const isBusy = busy === r.id;
          const script = editing[r.id] ?? r.script;
          const isEditing = !!editing[r.id];
          const poster = r.facts?.posterPath ? `https://image.tmdb.org/t/p/w185${r.facts.posterPath}` : null;
          return (
            <div key={r.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", gap: 14 }}>
                {poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" style={{ width: 64, borderRadius: 8, alignSelf: "flex-start" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 16 }}>{r.title ?? `#${r.tmdb_id}`}</strong>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}>
                      {r.media_type === "tv" ? "Serie" : "Película"}
                    </span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999,
                      background: r.status === "ready" ? "rgba(34,197,94,0.15)" : r.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                      color: r.status === "ready" ? "#86efac" : r.status === "failed" ? "#fca5a5" : "#fcd34d" }}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    {r.facts?.peekrRating != null && (
                      <span style={{ fontSize: 11, color: "#ff80bf" }}>★ {r.facts.peekrRating} Peekr ({r.facts.peekrRatingCount})</span>
                    )}
                    {r.duration_sec != null && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{r.duration_sec.toFixed(0)}s</span>}
                  </div>
                  {r.error && <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 6, whiteSpace: "pre-wrap" }}>{r.error.slice(0, 400)}</div>}

                  {/* Script editor */}
                  {script && (
                    <details open={r.status === "script_ready"} style={{ marginTop: 10 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>
                        Guion · hook: <em style={{ color: "#fff" }}>{script.hook}</em>
                      </summary>
                      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                        {script.beats.map((b, i) => (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, alignItems: "start" }}>
                            <div style={{ fontSize: 11, color: "#ff80bf", fontWeight: 700, paddingTop: 6 }}>{b.kind}</div>
                            <div style={{ display: "grid", gap: 4 }}>
                              <input
                                value={b.headline}
                                onChange={(e) => setEditing((m) => ({ ...m, [r.id]: patchBeat(script, i, { headline: e.target.value }) }))}
                                style={inp}
                                placeholder="Titular en pantalla"
                              />
                              {b.kind !== "hero_in" && (
                                <textarea
                                  value={b.voice}
                                  onChange={(e) => setEditing((m) => ({ ...m, [r.id]: patchBeat(script, i, { voice: e.target.value }) }))}
                                  style={{ ...inp, minHeight: 48, resize: "vertical" }}
                                  placeholder="Narración"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                        {isEditing && (
                          <div>
                            <button style={btn("rgba(255,255,255,0.08)", "rgba(255,255,255,0.2)", "#fff")}
                              onClick={() => act(r, "update_script", { script: editing[r.id] })} disabled={isBusy}>
                              💾 Guardar guion
                            </button>
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  {/* Video preview */}
                  {r.video_url && (
                    <video src={r.video_url} poster={r.thumbnail_url ?? undefined} controls playsInline
                      style={{ marginTop: 12, width: 220, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "#000" }} />
                  )}

                  {/* Copy blocks: full narration (for TikTok/IG manual caption) + IG caption */}
                  {script && (
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>
                        📋 Textos para copiar (locución + caption)
                      </summary>
                      <CopyBlock label="Locución completa (texto del reel)"
                        text={script.beats.map((b) => b.voice).filter(Boolean).join("\n\n")} />
                      <CopyBlock label="Caption Instagram / TikTok"
                        text={[r.caption ?? script.caption, r.hashtags ?? script.hashtags].filter(Boolean).join("\n\n")} />
                    </details>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {["script_ready", "failed", "ready"].includes(r.status) && r.script && (
                      <button style={btn("rgba(99,102,241,0.18)", "rgba(99,102,241,0.6)", "#c7d2fe")} onClick={() => act(r, "render")} disabled={isBusy || isEditing}
                        title={isEditing ? "Guardá el guion primero" : "Encola el render en el worker de Railway"}>
                        {r.status === "ready" ? "↻ Re-renderizar" : "🎞 Renderizar"}
                      </button>
                    )}
                    {r.status === "ready" && r.video_url && (
                      <a href={r.video_url} download={`peekr-reel-${(r.title ?? r.tmdb_id).toString().replace(/[^\w]+/g, "-").toLowerCase()}.mp4`}
                        style={{ ...btn("rgba(99,102,241,0.18)", "rgba(99,102,241,0.6)", "#c7d2fe"), textDecoration: "none" }}
                        title="Descarga el MP4 para subirlo a mano a TikTok / Instagram">
                        ⬇ Descargar MP4
                      </a>
                    )}
                    {r.status === "ready" && (
                      <button style={btn("#22c55e", "#22c55e", "#052e16")} onClick={() => act(r, "publish_ig")} disabled={isBusy || !!r.ig_queue_id}
                        title="Publica en @peekr.social con @peekr.app como colaborador (pasa por la cola de revisión)">
                        {r.ig_queue_id ? "✓ En revisión IG" : "📸 Enviar al IG de Peekr"}
                      </button>
                    )}
                    {r.trailer_youtube_key && (
                      <a href={`https://www.youtube.com/watch?v=${r.trailer_youtube_key}`} target="_blank" rel="noreferrer"
                        style={{ ...btn("transparent", "rgba(255,255,255,0.15)", "rgba(255,255,255,0.6)"), textDecoration: "none" }}>
                        ▶ Trailer
                      </a>
                    )}
                    <button style={btn("transparent", "rgba(255,255,255,0.15)", "rgba(255,255,255,0.5)")} onClick={() => { if (confirm("¿Descartar este reel?")) void act(r, "discard"); }} disabled={isBusy}>
                      Descartar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const inp: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 8, color: "#fff", padding: "6px 10px", fontSize: 13, fontFamily: "inherit",
};

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>{label}</span>
        <button
          onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11.5, cursor: "pointer" }}
        >
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
      <textarea readOnly value={text} style={{ ...inp, minHeight: 90, resize: "vertical", fontSize: 12.5, whiteSpace: "pre-wrap" }} />
    </div>
  );
}

function patchBeat(s: ReelScript, i: number, patch: Partial<Beat>): ReelScript {
  const beats = s.beats.map((b, j) => (j === i ? { ...b, ...patch } : b));
  return { ...s, beats };
}
