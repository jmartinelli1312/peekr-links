"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import CarouselSection from "./CarouselSection";
import CarouselsGeneratedSection from "./CarouselsGeneratedSection";

// ── Date helpers ──────────────────────────────────────────────────────────────

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

function formatRelativeDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(dt);
}

// ── Theme palette (shared by daily candidates) ────────────────────────────────

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

interface NewsletterEdition {
  id: number;
  edition_date: string;
  status: "pending_review" | "sent" | "cancelled";
  created_at: string;
  sent_at: string | null;
  total_sent: number | null;
  total_failed: number | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PeekrbuzzDailyTab({ supabase }: { supabase: SupabaseClient }) {
  const [targetDate, setTargetDate] = useState<string>(() => todayInArgentina());
  const [candidates, setCandidates] = useState<DailyCandidate[]>([]);
  const [publishedSiblings, setPublishedSiblings] = useState<Record<number, PublishedSibling[]>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<null | "approving" | "regenerating">(null);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const [newsletter, setNewsletter] = useState<NewsletterEdition | null>(null);
  const [newsletterBusy, setNewsletterBusy] = useState<null | "sending" | "testing">(null);
  const [testEmail, setTestEmail] = useState<string>("");

  // Bumped by any carousel action so both the embedded per-card status pill and
  // the dedicated section below re-fetch their state in sync.
  const [carouselRefreshKey, setCarouselRefreshKey] = useState<number>(0);
  const bumpCarouselRefresh = useCallback(() => setCarouselRefreshKey((n) => n + 1), []);

  // ── Newsletter loader ───────────────────────────────────────────────────────
  const loadNewsletter = useCallback(async () => {
    const { data } = await supabase
      .from("newsletter_editions")
      .select("id, edition_date, status, created_at, sent_at, total_sent, total_failed")
      .order("edition_date", { ascending: false })
      .limit(1);
    setNewsletter(((data ?? []) as NewsletterEdition[])[0] ?? null);
  }, [supabase]);

  // ── Daily candidates loader ────────────────────────────────────────────────
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
    void loadNewsletter();
  }, [loadNewsletter]);

  useEffect(() => {
    void loadDay(targetDate);
  }, [targetDate, loadDay]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isFreshDay = useMemo(
    () => candidates.length > 0 && candidates.every((c) => c.article_status === "daily_candidate"),
    [candidates],
  );
  const hasPublishedToday = useMemo(
    () => candidates.some((c) => c.article_status === "published"),
    [candidates],
  );
  const canApprove = isFreshDay && !busy && selectedIds.length >= 1 && selectedIds.length <= 2;
  const canRegenerate = isFreshDay && !busy && selectedIds.length >= 1;

  // ── Actions ─────────────────────────────────────────────────────────────────

  function toggleSelect(id: number) {
    if (!isFreshDay) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function approve() {
    if (!canApprove) return;
    setBusy("approving");
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      const summary = payload.results
        .map((r) => {
          const langs = [r.published_es && "ES", r.published_en && "EN", r.published_pt && "PT"]
            .filter(Boolean)
            .join("+");
          return `“${r.title.slice(0, 40)}” → ${langs}`;
        })
        .join(" · ");
      setInfo(`Publicado: ${summary}`);
      await loadDay(targetDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error publicando");
    } finally {
      setBusy(null);
    }
  }

  async function regenerateSelected() {
    if (!canRegenerate) return;
    setBusy("regenerating");
    setError("");
    setInfo("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session");

      const res = await fetch("/api/admin/peekrbuzz/regenerate-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ candidate_ids: selectedIds, target_date: targetDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      const refill = (data as { refill?: { candidates_inserted?: number } }).refill;
      setInfo(`Regenerados: ${selectedIds.length} descartados, ${refill?.candidates_inserted ?? "?"} nuevos`);
      await loadDay(targetDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error regenerando");
    } finally {
      setBusy(null);
    }
  }

  async function fullRefresh() {
    setBusy("regenerating");
    setError("");
    setInfo("Forzando regeneración completa…");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session");

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
      setError(err instanceof Error ? err.message : "Error refrescando");
    } finally {
      setBusy(null);
    }
  }

  // ── Newsletter actions ─────────────────────────────────────────────────────

  function openNewsletterPreview(lang: "es" | "pt") {
    window.open(`/api/admin/newsletter/preview?lang=${lang}`, "_blank");
  }

  async function sendNewsletterTest() {
    if (!newsletter || !testEmail) return;
    setNewsletterBusy("testing");
    setError("");
    setInfo("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session");
      const res = await fetch("/api/admin/newsletter/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: testEmail, lang: "es" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
      else setInfo(`Newsletter de prueba enviada a ${testEmail}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error enviando test");
    } finally {
      setNewsletterBusy(null);
    }
  }

  async function sendNewsletterFull() {
    if (!newsletter) return;
    if (!confirm(`¿Enviar newsletter del ${formatRelativeDate(newsletter.edition_date)} a todos los suscriptores?`)) return;
    setNewsletterBusy("sending");
    setError("");
    setInfo("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session");
      const res = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ edition_id: newsletter.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
      else {
        setInfo("Newsletter enviada");
        await loadNewsletter();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error enviando newsletter");
    } finally {
      setNewsletterBusy(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const today = todayInArgentina();
  const isToday = targetDate === today;

  return (
    <div className="ed-tab">
      <style>{`
        .ed-tab { display: flex; flex-direction: column; gap: 28px; }
        .ed-section h2 { margin: 0 0 14px 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
        .ed-section-sub { color: rgba(255,255,255,0.55); font-size: 13px; margin: -10px 0 14px 0; }
        .ed-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px 20px; }

        .nl-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        .nl-info { display: flex; flex-direction: column; gap: 4px; }
        .nl-title { font-size: 16px; font-weight: 800; color: white; }
        .nl-sub { font-size: 13px; color: rgba(255,255,255,0.6); }
        .nl-status { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
        .nl-status.pending { background: rgba(245,158,11,0.15); color: #fcd34d; border: 1px solid rgba(245,158,11,0.35); }
        .nl-status.sent { background: rgba(34,197,94,0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.35); }
        .nl-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .nl-actions input { padding: 7px 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; font-size: 13px; min-width: 200px; }
        .ed-btn { padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid; }
        .ed-btn-primary { background: #FA0082; border-color: #FA0082; color: white; }
        .ed-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .ed-btn-secondary { background: transparent; border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.75); }
        .ed-btn-secondary:hover:not(:disabled) { border-color: rgba(255,255,255,0.3); color: white; }
        .ed-btn-danger { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.4); color: #fca5a5; }
        .ed-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.2); }

        .ed-banner { padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; }
        .ed-banner.info { background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.3); color: #67e8f9; }
        .ed-banner.success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #86efac; }
        .ed-banner.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
        .ed-banner.warning { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #fcd34d; }

        .day-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .day-header h3 { margin: 0; font-size: 18px; font-weight: 800; }
        .day-date { color: rgba(255,255,255,0.6); font-size: 13px; margin-top: 2px; text-transform: capitalize; }
        .day-nav { display: flex; gap: 6px; }
        .day-nav button { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 12px; font-weight: 600; }
        .day-nav button:hover:not(:disabled) { background: rgba(250,0,130,0.15); border-color: rgba(250,0,130,0.4); }
        .day-nav button:disabled { opacity: 0.4; cursor: not-allowed; }

        .cand-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 900px) { .cand-grid { grid-template-columns: repeat(2, 1fr); } }

        .cand-card { background: rgba(255,255,255,0.04); border: 2px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.15s; }
        .cand-card.clickable { cursor: pointer; }
        .cand-card.clickable:hover { border-color: rgba(255,255,255,0.18); }
        .cand-card.selected { border-color: #FA0082; box-shadow: 0 0 0 1px rgba(250,0,130,0.4); }
        .cand-card.published { border-color: rgba(34,197,94,0.4); }
        .cand-card.rejected { opacity: 0.35; }

        .cand-image { width: 100%; aspect-ratio: 16 / 9; background: #111 center/cover no-repeat; }
        .cand-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 9px; flex: 1; }
        .cand-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .cand-theme-badge { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-weight: 800; color: white; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
        .cand-score-badge { display: inline-flex; padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); font-weight: 700; font-size: 11px; }
        .cand-selection { font-size: 11px; font-weight: 800; color: #FA0082; letter-spacing: 0.04em; }
        .cand-title { font-size: 16px; font-weight: 800; line-height: 1.3; color: white; margin: 0; }
        .cand-summary { font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; margin: 0; }
        .cand-entities { display: flex; flex-wrap: wrap; gap: 6px; }
        .cand-entity { display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 6px; background: rgba(250,0,130,0.1); border: 1px solid rgba(250,0,130,0.25); color: #ffc8e2; font-size: 11px; font-weight: 700; }
        .cand-entity .pop { opacity: 0.7; margin-left: 6px; font-size: 10px; font-weight: 600; }
        .cand-footer { display: flex; gap: 10px; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 4px; flex-wrap: wrap; }
        .cand-source { font-size: 11px; color: rgba(255,255,255,0.5); text-decoration: none; }
        .cand-source:hover { color: #ffc8e2; }
        .cand-pub-links { display: flex; gap: 6px; }
        .cand-pub-link { font-size: 11px; padding: 3px 9px; border-radius: 6px; background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #86efac; text-decoration: none; font-weight: 700; }
        .cand-pub-link:hover { background: rgba(34,197,94,0.25); }

        .action-bar { position: sticky; bottom: 16px; background: rgba(11,11,15,0.95); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .action-status { font-size: 13px; font-weight: 700; }
        .action-buttons { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .action-buttons .ed-btn { padding: 10px 18px; }

        .empty { padding: 50px 24px; text-align: center; color: rgba(255,255,255,0.5); font-size: 14px; background: rgba(255,255,255,0.02); border-radius: 12px; }
      `}</style>

      {error && <div className="ed-banner error">⚠ {error}</div>}
      {info && <div className="ed-banner success">{info}</div>}

      {/* ──────────────────────── SECTION 1 — NEWSLETTER ──────────────────────── */}
      <section className="ed-section">
        <h2>Newsletter</h2>
        <p className="ed-section-sub">
          Preview de la edición pendiente. La draft se genera el lunes 13:00 UTC, se envía el lunes 13:30 UTC.
        </p>

        {newsletter ? (
          <div className="ed-card">
            <div className="nl-row">
              <div className="nl-info">
                <div className="nl-title">
                  Edición del {formatRelativeDate(newsletter.edition_date)}
                  {"  "}
                  <span className={`nl-status ${newsletter.status === "sent" ? "sent" : "pending"}`}>
                    {newsletter.status === "sent" ? "Enviada" : newsletter.status === "pending_review" ? "Pendiente" : newsletter.status}
                  </span>
                </div>
                <div className="nl-sub">
                  {newsletter.status === "sent"
                    ? `Enviada a ${newsletter.total_sent ?? 0} suscriptores${newsletter.total_failed ? ` · ${newsletter.total_failed} fallidos` : ""}`
                    : `Creada ${new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(newsletter.created_at))}`}
                </div>
              </div>
              <div className="nl-actions">
                <button className="ed-btn ed-btn-secondary" onClick={() => openNewsletterPreview("es")}>
                  Preview ES
                </button>
                <button className="ed-btn ed-btn-secondary" onClick={() => openNewsletterPreview("pt")}>
                  Preview PT
                </button>
                {newsletter.status === "pending_review" && (
                  <>
                    <input
                      type="email"
                      placeholder="email para test"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <button
                      className="ed-btn ed-btn-secondary"
                      onClick={sendNewsletterTest}
                      disabled={!testEmail || newsletterBusy !== null}
                    >
                      {newsletterBusy === "testing" ? "Enviando…" : "Test"}
                    </button>
                    <button
                      className="ed-btn ed-btn-primary"
                      onClick={sendNewsletterFull}
                      disabled={newsletterBusy !== null}
                    >
                      {newsletterBusy === "sending" ? "Enviando…" : "Enviar ahora"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="ed-card empty">Sin edición pendiente. Próxima draft: lunes 13:00 UTC.</div>
        )}
      </section>

      {/* ──────────────────────── SECTION 2 — DAILY ARTICLES ──────────────────────── */}
      <section className="ed-section">
        <div className="day-header">
          <div>
            <h2>Aprobación de artículos</h2>
            <div className="day-date">{formatDateLong(targetDate)}</div>
          </div>
          <div className="day-nav">
            <button onClick={() => setTargetDate(shiftDate(targetDate, -1))}>← Día anterior</button>
            <button onClick={() => setTargetDate(today)} disabled={isToday}>
              Hoy
            </button>
            <button onClick={() => setTargetDate(shiftDate(targetDate, 1))}>Día siguiente →</button>
          </div>
        </div>
        <p className="ed-section-sub">
          4 candidatos ES generados a las 09:00 UTC (06:00 ART). Seleccioná los que quieras aprobar (1-2) y publicalos en ES, EN y PT, o seleccioná los que NO te gustan y dale a Regenerar para reemplazarlos.
        </p>

        {loading ? (
          <div className="empty">Cargando candidatos…</div>
        ) : candidates.length === 0 ? (
          <>
            <div className="ed-banner warning">
              Sin candidatos para esta fecha. El cron de selección corre a las 09:00 UTC. Si ya pasó, dale a “Regenerar todo”.
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <button className="ed-btn ed-btn-secondary" onClick={fullRefresh} disabled={busy !== null}>
                {busy === "regenerating" ? "Generando…" : "Regenerar todo"}
              </button>
            </div>
          </>
        ) : (
          <>
            {hasPublishedToday && (
              <div className="ed-banner info" style={{ marginBottom: 14 }}>
                Ya se publicó la edición de {formatRelativeDate(targetDate)} (los cards verdes).
              </div>
            )}

            <div className="cand-grid">
              {candidates.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                const isPublished = c.article_status === "published";
                const isRejected = c.article_status === "rejected";
                const clickable = isFreshDay && !isPublished && !isRejected;
                const theme = c.editorial_theme ?? "actualidad";
                const themeColor = THEME_COLORS[theme] ?? "#888";
                const themeLabel = THEME_LABELS[theme] ?? theme;

                const titles = c.entity_matches?.titles ?? [];
                const people = c.entity_matches?.people ?? [];
                const siblings = publishedSiblings[c.id] ?? [];

                return (
                  <div
                    key={c.id}
                    className={`cand-card${clickable ? " clickable" : ""}${isSelected ? " selected" : ""}${isPublished ? " published" : ""}${isRejected ? " rejected" : ""}`}
                    onClick={() => toggleSelect(c.id)}
                  >
                    {c.image_url && (
                      <div
                        className="cand-image"
                        style={{ backgroundImage: `url(${JSON.stringify(c.image_url)})` }}
                        aria-hidden
                      />
                    )}
                    <div className="cand-body">
                      <div className="cand-meta">
                        <span className="cand-theme-badge" style={{ background: themeColor }}>
                          {themeLabel}
                        </span>
                        {c.viral_score != null && (
                          <span className="cand-score-badge">Viral {Math.round(c.viral_score)}</span>
                        )}
                        {c.popularity_score != null && (
                          <span className="cand-score-badge">Pop {Math.round(c.popularity_score)}</span>
                        )}
                        {isSelected && <span className="cand-selection">✓ SELECCIONADO</span>}
                        {isPublished && <span className="cand-selection">PUBLICADO</span>}
                        {isRejected && <span className="cand-selection" style={{ color: "rgba(255,255,255,0.4)" }}>RECHAZADO</span>}
                      </div>
                      <h3 className="cand-title">{c.title}</h3>
                      <p className="cand-summary">{c.summary}</p>

                      {(titles.length > 0 || people.length > 0) && (
                        <div className="cand-entities">
                          {titles.slice(0, 3).map((t) => (
                            <span key={`t-${t.tmdb_id}`} className="cand-entity">
                              🎬 {t.name}
                              <span className="pop">{Math.round(t.popularity)}</span>
                            </span>
                          ))}
                          {people.slice(0, 3).map((p) => (
                            <span key={`p-${p.tmdb_id}`} className="cand-entity">
                              👤 {p.name}
                              <span className="pop">{Math.round(p.popularity)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="cand-footer">
                        {c.source_url ? (
                          <a
                            href={c.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="cand-source"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Fuente: {c.source_name ?? "RSS"} ↗
                          </a>
                        ) : (
                          <span className="cand-source">Sin fuente</span>
                        )}
                        {isPublished && siblings.length > 0 && (
                          <div className="cand-pub-links" onClick={(e) => e.stopPropagation()}>
                            {siblings.map((s) => (
                              <a
                                key={s.language}
                                href={`/${s.language}/buzz/${s.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="cand-pub-link"
                              >
                                {s.language.toUpperCase()}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {isPublished && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <CarouselSection
                            supabase={supabase}
                            articleId={c.id}
                            refreshKey={carouselRefreshKey}
                            onChanged={bumpCarouselRefresh}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {isFreshDay && (
              <div className="action-bar">
                <div className="action-status">
                  {selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}
                  {busy === "approving" && " · publicando…"}
                  {busy === "regenerating" && " · regenerando…"}
                </div>
                <div className="action-buttons">
                  <button
                    className="ed-btn ed-btn-danger"
                    onClick={regenerateSelected}
                    disabled={!canRegenerate}
                  >
                    Regenerar ({selectedIds.length})
                  </button>
                  <button
                    className="ed-btn ed-btn-primary"
                    onClick={approve}
                    disabled={!canApprove}
                  >
                    Aprobar y publicar ES · EN · PT ({selectedIds.length})
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ──────────────── SECTION 3 — GENERATED CAROUSELS ─────────────────── */}
      {/* Anchor used by the embedded "Ver abajo ↓" link in each article card. */}
      <section id="carruseles-generados">
        <CarouselsGeneratedSection
          supabase={supabase}
          articleIds={candidates
            .filter((c) => c.article_status === "published")
            .map((c) => c.id)}
          key={`carousels-${carouselRefreshKey}`}
          onChanged={bumpCarouselRefresh}
        />
      </section>
    </div>
  );
}
