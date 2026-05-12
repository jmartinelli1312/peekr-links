"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ARG_OFFSET_HOURS = -3;

function todayInArgentina(): string {
  const argMs = Date.now() + ARG_OFFSET_HOURS * 3_600_000;
  const arg = new Date(argMs);
  const y = arg.getUTCFullYear();
  const m = String(arg.getUTCMonth() + 1).padStart(2, "0");
  const d = String(arg.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(dt);
}

const THEME_COLORS: Record<string, string> = {
  actualidad: "#06b6d4",
  lanzamiento: "#f97316",
  historia: "#a855f7",
  dato_peekr: "#22c55e",
};

const THEME_LABELS: Record<string, string> = {
  actualidad: "Actualidad",
  lanzamiento: "Lanzamiento",
  historia: "Historia",
  dato_peekr: "Dato Peekr",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntityMatchesJson {
  titles?: Array<{ name: string; tmdb_id: number; popularity: number; media_type?: string }>;
  people?: Array<{ name: string; tmdb_id: number; popularity: number }>;
  reason?: string;
}

interface DailyCandidate {
  id: number;
  title: string;
  summary: string;
  body_html: string | null;
  image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  editorial_theme: string | null;
  popularity_score: number | null;
  viral_score: number | null;
  entity_matches: EntityMatchesJson | null;
  article_status: string;
  candidate_for_date: string;
  topic_key: string | null;
  slug: string;
}

interface PublishedSibling {
  language: "es" | "en" | "pt";
  slug: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PeekrbuzzDailyTab({ supabase }: { supabase: SupabaseClient }) {
  const [targetDate, setTargetDate] = useState<string>(() => todayInArgentina());
  const [candidates, setCandidates] = useState<DailyCandidate[]>([]);
  const [publishedSiblings, setPublishedSiblings] = useState<Record<number, PublishedSibling[]>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const loadDay = useCallback(
    async (date: string) => {
      setLoading(true);
      setError("");
      setInfo("");
      setSelectedIds([]);
      setPublishedSiblings({});

      const { data, error: fetchErr } = await supabase
        .from("peekrbuzz_articles")
        .select(
          "id, title, summary, body_html, image_url, source_url, source_name, editorial_theme, popularity_score, viral_score, entity_matches, article_status, candidate_for_date, topic_key, slug",
        )
        .eq("candidate_for_date", date)
        .eq("language", "es")
        .in("article_status", ["daily_candidate", "selected", "published"])
        .order("viral_score", { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
        setCandidates([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as DailyCandidate[];
      setCandidates(rows);

      // For any published row, fetch its EN/PT siblings so the UI can link to
      // the published versions in all three languages.
      const publishedRows = rows.filter((r) => r.article_status === "published" && r.topic_key);
      if (publishedRows.length > 0) {
        const topicBases = publishedRows
          .map((r) => (r.topic_key ?? "").replace(/-(es|en|pt)$/i, ""))
          .filter(Boolean);
        const siblingTopicKeys = topicBases.flatMap((base) => [`${base}-en`, `${base}-pt`]);

        const { data: sibs } = await supabase
          .from("peekrbuzz_articles")
          .select("slug, language, topic_key")
          .in("topic_key", siblingTopicKeys);

        const byCandidate: Record<number, PublishedSibling[]> = {};
        for (const r of publishedRows) {
          const base = (r.topic_key ?? "").replace(/-(es|en|pt)$/i, "");
          const mine: PublishedSibling[] = [{ language: "es", slug: r.slug }];
          for (const s of (sibs ?? []) as Array<{ slug: string; language: "es" | "en" | "pt"; topic_key: string }>) {
            const sBase = (s.topic_key ?? "").replace(/-(es|en|pt)$/i, "");
            if (sBase === base && s.language !== "es") {
              mine.push({ language: s.language, slug: s.slug });
            }
          }
          byCandidate[r.id] = mine;
        }
        setPublishedSiblings(byCandidate);
      }

      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    void loadDay(targetDate);
  }, [targetDate, loadDay]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const hasPublishedToday = useMemo(
    () => candidates.some((c) => c.article_status === "published"),
    [candidates],
  );
  const isFreshDay = useMemo(
    () => candidates.every((c) => c.article_status === "daily_candidate"),
    [candidates],
  );
  const canApprove =
    selectedIds.length > 0 && selectedIds.length <= 2 && isFreshDay && !publishing;

  function toggleSelect(id: number) {
    if (!isFreshDay) return;
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev; // hard cap
      return [...prev, id];
    });
  }

  async function approve() {
    if (!canApprove) return;
    setPublishing(true);
    setError("");
    setInfo("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session");

      const res = await fetch("/api/admin/peekrbuzz/approve-daily", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidate_ids: selectedIds, target_date: targetDate }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }

      type ApproveResult = {
        results: Array<{
          candidate_id: number;
          title: string;
          published_es: boolean;
          published_en: boolean;
          published_pt: boolean;
          errors: string[];
        }>;
      };
      const payload = data as ApproveResult;
      const langSummary = payload.results
        .map((r) => {
          const langs = [r.published_es && "ES", r.published_en && "EN", r.published_pt && "PT"]
            .filter(Boolean)
            .join("+");
          return `"${r.title.slice(0, 40)}" → ${langs}`;
        })
        .join(" · ");
      setInfo(`Publicado: ${langSummary}`);

      // Reload the day to pull published siblings + reject the rest.
      await loadDay(targetDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error publicando");
    } finally {
      setPublishing(false);
    }
  }

  async function regenerate() {
    setError("");
    setInfo("Regenerando candidatos…");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session");

      // Trigger via the admin-proxy endpoint defined below
      const res = await fetch(`/api/admin/peekrbuzz/trigger-select?date=${targetDate}&force=1`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      setInfo(`Regenerado: ${(data as { candidates_inserted?: number }).candidates_inserted ?? "?"} candidatos`);
      await loadDay(targetDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error regenerando");
    }
  }

  const today = todayInArgentina();
  const isToday = targetDate === today;

  return (
    <div className="pbz-daily">
      <style>{`
        .pbz-daily { display: flex; flex-direction: column; gap: 18px; }
        .pbz-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .pbz-title { font-size: 28px; font-weight: 900; letter-spacing: -0.02em; margin: 0; }
        .pbz-date { color: rgba(255,255,255,0.6); font-size: 14px; margin-top: 4px; text-transform: capitalize; }
        .pbz-nav { display: flex; gap: 6px; align-items: center; }
        .pbz-nav button { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px; font-weight: 600; }
        .pbz-nav button:hover { background: rgba(250,0,130,0.15); border-color: rgba(250,0,130,0.4); }
        .pbz-nav button:disabled { opacity: 0.4; cursor: not-allowed; }

        .pbz-banner { padding: 14px 18px; border-radius: 12px; font-size: 14px; font-weight: 600; }
        .pbz-banner.info { background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.3); color: #67e8f9; }
        .pbz-banner.success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #86efac; }
        .pbz-banner.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
        .pbz-banner.warning { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #fcd34d; }

        .pbz-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 900px) { .pbz-grid { grid-template-columns: repeat(2, 1fr); } }

        .pbz-card { background: rgba(255,255,255,0.04); border: 2px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 0; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.15s, transform 0.15s; cursor: pointer; }
        .pbz-card:hover:not(.disabled) { border-color: rgba(255,255,255,0.18); }
        .pbz-card.selected { border-color: #FA0082; box-shadow: 0 0 0 1px rgba(250,0,130,0.4); }
        .pbz-card.published { border-color: rgba(34,197,94,0.4); cursor: default; }
        .pbz-card.rejected { opacity: 0.35; cursor: default; }
        .pbz-card.disabled { cursor: default; }

        .pbz-card-image { width: 100%; aspect-ratio: 16 / 9; background: #111 center/cover no-repeat; }
        .pbz-card-body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .pbz-card-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 11px; }
        .pbz-theme-badge { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-weight: 800; color: white; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
        .pbz-score-badge { display: inline-flex; padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); font-weight: 700; font-size: 11px; }
        .pbz-card-title { font-size: 17px; font-weight: 800; line-height: 1.3; color: white; margin: 0; }
        .pbz-card-summary { font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; margin: 0; }
        .pbz-entities { display: flex; flex-wrap: wrap; gap: 6px; }
        .pbz-entity { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 6px; background: rgba(250,0,130,0.1); border: 1px solid rgba(250,0,130,0.25); color: #ffc8e2; font-size: 11px; font-weight: 700; }
        .pbz-entity .pop { opacity: 0.7; margin-left: 6px; font-size: 10px; font-weight: 600; }
        .pbz-card-footer { display: flex; gap: 12px; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 4px; }
        .pbz-source-link { font-size: 11px; color: rgba(255,255,255,0.5); text-decoration: none; }
        .pbz-source-link:hover { color: #ffc8e2; }
        .pbz-selection-indicator { font-size: 12px; font-weight: 800; color: #FA0082; }

        .pbz-publish-bar { position: sticky; bottom: 16px; background: rgba(11,11,15,0.95); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        .pbz-publish-status { font-size: 14px; font-weight: 700; }
        .pbz-publish-actions { display: flex; gap: 8px; align-items: center; }
        .pbz-btn-primary { padding: 10px 22px; border-radius: 10px; background: #FA0082; border: 1px solid #FA0082; color: white; font-weight: 800; font-size: 14px; cursor: pointer; }
        .pbz-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; background: rgba(250,0,130,0.4); }
        .pbz-btn-secondary { padding: 10px 16px; border-radius: 10px; background: transparent; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); font-weight: 700; font-size: 13px; cursor: pointer; }
        .pbz-btn-secondary:hover { border-color: rgba(255,255,255,0.3); color: white; }

        .pbz-published-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .pbz-published-link { font-size: 11px; padding: 4px 10px; border-radius: 6px; background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #86efac; text-decoration: none; font-weight: 700; }
        .pbz-published-link:hover { background: rgba(34,197,94,0.25); }

        .pbz-empty { padding: 60px 24px; text-align: center; color: rgba(255,255,255,0.5); font-size: 14px; background: rgba(255,255,255,0.02); border-radius: 12px; }
      `}</style>

      <div className="pbz-header">
        <div>
          <h2 className="pbz-title">Peekrbuzz · Diario</h2>
          <div className="pbz-date">{formatDateLong(targetDate)}</div>
        </div>
        <div className="pbz-nav">
          <button onClick={() => setTargetDate(shiftDate(targetDate, -1))} aria-label="Día anterior">
            ← Día anterior
          </button>
          <button onClick={() => setTargetDate(today)} disabled={isToday}>
            Hoy
          </button>
          <button onClick={() => setTargetDate(shiftDate(targetDate, 1))} aria-label="Día siguiente">
            Día siguiente →
          </button>
        </div>
      </div>

      {error && <div className="pbz-banner error">⚠ {error}</div>}
      {info && <div className="pbz-banner success">{info}</div>}

      {loading ? (
        <div className="pbz-empty">Cargando candidatos…</div>
      ) : candidates.length === 0 ? (
        <>
          <div className="pbz-banner warning">
            Sin candidatos para esta fecha. El cron de selección corre a las 09:00 UTC (06:00 ART). Si ya pasó esa hora, dale a “Regenerar”.
          </div>
          <div className="pbz-empty">No hay candidatos para {formatDateLong(targetDate)}.</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="pbz-btn-secondary" onClick={regenerate}>
              Regenerar manualmente
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="pbz-banner info">
            {hasPublishedToday
              ? `Ya se publicó la edición de ${formatDateLong(targetDate)}.`
              : `${candidates.length} candidatos listos. Elegí 2 y aprobá para publicar en ES, EN y PT.`}
          </div>

          <div className="pbz-grid">
            {candidates.map((c) => {
              const isSelected = selectedIds.includes(c.id);
              const isPublished = c.article_status === "published";
              const isRejected = c.article_status === "rejected";
              const theme = c.editorial_theme ?? "actualidad";
              const themeColor = THEME_COLORS[theme] ?? "#888";
              const themeLabel = THEME_LABELS[theme] ?? theme;

              const titles = c.entity_matches?.titles ?? [];
              const people = c.entity_matches?.people ?? [];
              const siblings = publishedSiblings[c.id] ?? [];

              return (
                <div
                  key={c.id}
                  className={`pbz-card${isSelected ? " selected" : ""}${isPublished ? " published" : ""}${isRejected ? " rejected" : ""}${!isFreshDay ? " disabled" : ""}`}
                  onClick={() => toggleSelect(c.id)}
                >
                  {c.image_url && (
                    <div
                      className="pbz-card-image"
                      style={{ backgroundImage: `url(${JSON.stringify(c.image_url)})` }}
                      aria-hidden
                    />
                  )}
                  <div className="pbz-card-body">
                    <div className="pbz-card-meta">
                      <span className="pbz-theme-badge" style={{ background: themeColor }}>
                        {themeLabel}
                      </span>
                      {c.viral_score != null && (
                        <span className="pbz-score-badge">Viral {Math.round(c.viral_score)}</span>
                      )}
                      {c.popularity_score != null && (
                        <span className="pbz-score-badge">Pop {Math.round(c.popularity_score)}</span>
                      )}
                      {isSelected && <span className="pbz-selection-indicator">✓ SELECCIONADO</span>}
                      {isPublished && <span className="pbz-selection-indicator">PUBLICADO</span>}
                      {isRejected && <span className="pbz-selection-indicator" style={{ color: "rgba(255,255,255,0.4)" }}>RECHAZADO</span>}
                    </div>
                    <h3 className="pbz-card-title">{c.title}</h3>
                    <p className="pbz-card-summary">{c.summary}</p>

                    {(titles.length > 0 || people.length > 0) && (
                      <div className="pbz-entities">
                        {titles.slice(0, 3).map((t) => (
                          <span key={`t-${t.tmdb_id}`} className="pbz-entity">
                            🎬 {t.name}
                            <span className="pop">{Math.round(t.popularity)}</span>
                          </span>
                        ))}
                        {people.slice(0, 3).map((p) => (
                          <span key={`p-${p.tmdb_id}`} className="pbz-entity">
                            👤 {p.name}
                            <span className="pop">{Math.round(p.popularity)}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pbz-card-footer">
                      {c.source_url ? (
                        <a
                          href={c.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="pbz-source-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Fuente: {c.source_name ?? "RSS"} ↗
                        </a>
                      ) : (
                        <span className="pbz-source-link">Sin fuente</span>
                      )}
                      {isPublished && siblings.length > 0 && (
                        <div className="pbz-published-row" onClick={(e) => e.stopPropagation()}>
                          {siblings.map((s) => (
                            <a
                              key={s.language}
                              href={`/${s.language}/buzz/${s.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="pbz-published-link"
                            >
                              {s.language.toUpperCase()}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {isFreshDay && (
            <div className="pbz-publish-bar">
              <div className="pbz-publish-status">
                {selectedIds.length}/2 seleccionados
                {publishing && " · publicando…"}
              </div>
              <div className="pbz-publish-actions">
                <button className="pbz-btn-secondary" onClick={regenerate} disabled={publishing}>
                  Regenerar
                </button>
                <button className="pbz-btn-primary" disabled={!canApprove} onClick={approve}>
                  Aprobar y publicar (ES · EN · PT)
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
