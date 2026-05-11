"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduledArticle = {
  id: number;
  title: string;
  language: "es" | "pt" | "en";
  day_slot: number;
  is_published: boolean;
  article_status: string;
  category: string | null;
  source_url: string | null;
};

type ScheduledCarousel = {
  id: string;
  theme_type: "actualidad" | "historia" | "reco";
  day_slot: number;
  hook_text: string;
  status: "approved" | "published";
  caption: string | null;
};

type WeekPlan = {
  week_key: string;
  week_start: string;
  week_end: string;
  status: string;
  newsletter_draft_es: string | null;
  newsletter_draft_pt: string | null;
};

type PendingCreator = {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

interface Props {
  supabase: SupabaseClient;
  onApproveCreator?: (id: string, userId: string) => void;
  onRejectCreator?: (id: string, userId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const THEMES = ["actualidad", "historia", "reco"] as const;
type ThemeType = (typeof THEMES)[number];

const THEME_LABELS: Record<ThemeType, string> = {
  actualidad: "📰 Actualidad",
  historia:   "🎬 Historia",
  reco:       "⭐ Reco (Jueves)",
};

const THEME_COLORS: Record<ThemeType, string> = {
  actualidad: "#0ea5e9",
  historia:   "#f59e0b",
  reco:       "#10b981",
};

// Default UTC publish times per channel
const PUBLISH_HOURS: Record<string, number> = {
  newsletter_es: 8,
  newsletter_pt: 8,
  buzz_es: 9,
  buzz_pt: 9,
  buzz_en: 9,
  actualidad: 13,
  historia:   15,
  reco:       14,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  return `${d.getFullYear()}-W${String(isoWeekNumber(d)).padStart(2, "0")}`;
}

function getWeekStart(weekKey: string): Date {
  const [yearStr, wStr] = weekKey.split("-W");
  const year = Number(yearStr);
  const week = Number(wStr);
  // Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Mon=1 ... Sun=7
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function shiftWeek(weekKey: string, n: number): string {
  const start = getWeekStart(weekKey);
  start.setDate(start.getDate() + n * 7);
  return getWeekKey(start);
}

function currentOrNextWeekKey(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  if (day === 6) {
    // Saturday → show next week
    const next = new Date(now);
    next.setDate(now.getDate() + 2);
    return getWeekKey(next);
  }
  if (day === 0) {
    // Sunday → show next week
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    return getWeekKey(next);
  }
  return getWeekKey(now);
}

function scheduledLabel(weekStart: Date, dayIndex: number, channelKey: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  const h = PUBLISH_HOURS[channelKey] ?? 9;
  d.setUTCHours(h, 0, 0, 0);
  return d.toLocaleString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

function formatDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(v));
  } catch { return "—"; }
}

// ─── Cell component ───────────────────────────────────────────────────────────

function ScheduleCell({
  title,
  time,
  published,
  empty,
  color,
}: {
  title?: string | null;
  time?: string;
  published?: boolean;
  empty?: boolean;
  color?: string;
}) {
  if (empty || !title) {
    return (
      <div style={{
        minHeight: "54px",
        borderRadius: "6px",
        background: "#0a0a0a",
        border: "1px solid #1a1a1a",
      }} />
    );
  }

  return (
    <div style={{
      minHeight: "54px",
      borderRadius: "6px",
      padding: "6px 8px",
      background: published ? "#052e16" : "#1c1917",
      border: `1px solid ${published ? "#166534" : color ? color + "33" : "#292524"}`,
      cursor: "default",
    }}>
      <div style={{
        fontSize: "11px",
        fontWeight: 500,
        lineHeight: 1.3,
        marginBottom: "4px",
        color: published ? "#86efac" : "#d6d3d1",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {title}
      </div>
      {time && (
        <div style={{ fontSize: "9px", color: "#57534e", marginBottom: "3px" }}>{time}</div>
      )}
      <span style={{
        fontSize: "9px",
        padding: "1px 5px",
        borderRadius: "3px",
        background: published ? "#166534" : "#292524",
        color: published ? "#86efac" : "#a8a29e",
      }}>
        {published ? "✅ Publicado" : "⏰ Pendiente"}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicationScheduleTab({ supabase, onApproveCreator, onRejectCreator }: Props) {
  const [weekKey, setWeekKey] = useState<string>(currentOrNextWeekKey);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [articles, setArticles] = useState<ScheduledArticle[]>([]);
  const [carousels, setCarousels] = useState<ScheduledCarousel[]>([]);
  const [creators, setCreators] = useState<PendingCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewText, setPreviewText] = useState<{ title: string; body: string } | null>(null);

  const weekStart = getWeekStart(weekKey);
  const dayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [planRes, articlesRes, carouselsRes, creatorsRes] = await Promise.all([
      supabase
        .from("weekly_editorial_plans")
        .select("week_key, week_start, week_end, status, newsletter_draft_es, newsletter_draft_pt")
        .eq("week_key", weekKey)
        .maybeSingle(),
      supabase
        .from("peekrbuzz_articles")
        .select("id, title, language, day_slot, is_published, article_status, category, source_url")
        .eq("week_key", weekKey)
        .eq("article_status", "selected")
        .order("day_slot"),
      supabase
        .from("peekrbuzz_ig_queue")
        .select("id, theme_type, day_slot, hook_text, status, caption")
        .eq("week_key", weekKey)
        .in("status", ["approved", "published"])
        .order("day_slot"),
      supabase
        .from("creator_applications")
        .select("id, user_id, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    setPlan(planRes.data ?? null);
    setArticles((articlesRes.data as ScheduledArticle[]) ?? []);
    setCarousels((carouselsRes.data as ScheduledCarousel[]) ?? []);

    // Enrich creators with profile data
    const apps = (creatorsRes.data ?? []) as Array<{ id: string; user_id: string; created_at?: string | null }>;
    if (apps.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", apps.map((a) => a.user_id));
      const pm = new Map((profiles ?? []).map((p: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null }) => [p.id, p]));
      setCreators(apps.map((a) => ({
        id: a.id,
        user_id: a.user_id,
        created_at: a.created_at ?? null,
        username: pm.get(a.user_id)?.username ?? null,
        display_name: pm.get(a.user_id)?.display_name ?? null,
        avatar_url: pm.get(a.user_id)?.avatar_url ?? null,
      })));
    } else {
      setCreators([]);
    }
    setLoading(false);
  }, [supabase, weekKey]);

  useEffect(() => { loadData(); }, [loadData]);

  function articleForDay(lang: "es" | "pt" | "en", day: number) {
    return articles.find((a) => a.language === lang && a.day_slot === day) ?? null;
  }

  function carouselForDay(theme: ThemeType, day: number) {
    return carousels.find((c) => c.theme_type === theme && c.day_slot === day) ?? null;
  }

  // Published counts per channel
  const publishedByLang = (lang: "es" | "pt" | "en") =>
    articles.filter((a) => a.language === lang && a.is_published).length;
  const publishedByTheme = (theme: ThemeType) =>
    carousels.filter((c) => c.theme_type === theme && c.status === "published").length;

  const today = new Date().toDateString();
  const statusColor: Record<string, string> = {
    approved: "#14532d",
    published: "#0c4a6e",
    generating: "#3b1f08",
    ready: "#1e3a5f",
    in_review: "#2d1f5e",
  };

  return (
    <div style={{ color: "#e5e5e5", paddingBottom: "40px" }}>

      {/* ── Week navigation ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingTop: "8px" }}>
        <button
          onClick={() => setWeekKey((k) => shiftWeek(k, -1))}
          style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", padding: "6px 14px", color: "#e5e5e5", cursor: "pointer", fontSize: "13px" }}
        >
          ← Anterior
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "15px" }}>
            {weekKey} · {dayDates[0].toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
            {" – "}
            {dayDates[6].toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          {plan && (
            <span style={{
              marginLeft: "10px",
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: statusColor[plan.status] ?? "#1c1917",
              color: "#e5e5e5",
            }}>
              {plan.status}
            </span>
          )}
        </div>
        <button
          onClick={() => setWeekKey((k) => shiftWeek(k, 1))}
          style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", padding: "6px 14px", color: "#e5e5e5", cursor: "pointer", fontSize: "13px" }}
        >
          Siguiente →
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>Cargando cronograma…</div>
      ) : !plan ? (
        <div style={{
          textAlign: "center",
          padding: "60px",
          color: "#6b7280",
          background: "#0f0f0f",
          borderRadius: "12px",
          border: "1px solid #1a1a1a",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📅</div>
          <div style={{ fontWeight: 600, marginBottom: "6px" }}>Sin plan para esta semana</div>
          <div style={{ fontSize: "12px" }}>Los borradores se generan automáticamente el sábado entre 23:00 y 06:00 UTC.</div>
        </div>
      ) : (
        <>
          {/* ── Summary chips ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            {(["es", "pt", "en"] as const).map((lang) => {
              const total = articles.filter((a) => a.language === lang).length;
              const pub = publishedByLang(lang);
              return (
                <div key={lang} style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  fontSize: "12px",
                  color: lang === "en" ? "#38bdf8" : lang === "pt" ? "#4ade80" : "#fb923c",
                }}>
                  Buzz {lang.toUpperCase()}: {pub}/{total}
                </div>
              );
            })}
            {THEMES.map((theme) => {
              const total = carousels.filter((c) => c.theme_type === theme).length;
              const pub = publishedByTheme(theme);
              return (
                <div key={theme} style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "#1a1a1a",
                  border: `1px solid ${THEME_COLORS[theme]}33`,
                  fontSize: "12px",
                  color: THEME_COLORS[theme],
                }}>
                  {theme}: {pub}/{total}
                </div>
              );
            })}
          </div>

          {/* ── Schedule grid ─────────────────────────────────────────────── */}
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "3px",
              tableLayout: "fixed",
            }}>
              <colgroup>
                <col style={{ width: "130px" }} />
                {DAYS_ES.map((_, i) => <col key={i} style={{ width: "calc((100% - 130px) / 7)" }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#4b5563", fontSize: "11px", fontWeight: 600 }}>
                    Canal
                  </th>
                  {DAYS_ES.map((d, i) => (
                    <th key={d} style={{
                      textAlign: "center",
                      padding: "6px 4px",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: dayDates[i].toDateString() === today ? "#a78bfa" : "#6b7280",
                    }}>
                      {d}
                      <div style={{ fontSize: "9px", fontWeight: 400, color: "#4b5563" }}>
                        {dayDates[i].toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Newsletter ES */}
                <tr>
                  <td style={{ padding: "2px 8px 2px 0", fontSize: "11px", fontWeight: 600, color: "#c4b5fd", verticalAlign: "top", whiteSpace: "nowrap" }}>
                    📧 Newsletter ES
                  </td>
                  {[1,2,3,4,5,6,7].map((day) => (
                    <td key={day} style={{ padding: "2px" }}>
                      {day === 1 && plan.newsletter_draft_es ? (
                        <div
                          onClick={() => setPreviewText({ title: "Newsletter ES", body: plan.newsletter_draft_es! })}
                          style={{
                            minHeight: "54px",
                            borderRadius: "6px",
                            padding: "6px 8px",
                            background: "#1c1917",
                            border: "1px solid #a78bfa33",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontSize: "11px", color: "#c4b5fd", fontWeight: 500, marginBottom: "3px" }}>Ver draft →</div>
                          <div style={{ fontSize: "9px", color: "#57534e" }}>{scheduledLabel(weekStart, 0, "newsletter_es")}</div>
                          <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: "#292524", color: "#a8a29e" }}>⏰ Pendiente</span>
                        </div>
                      ) : (
                        <ScheduleCell empty={day !== 1 || !plan.newsletter_draft_es} />
                      )}
                    </td>
                  ))}
                </tr>

                {/* Newsletter PT */}
                <tr>
                  <td style={{ padding: "2px 8px 2px 0", fontSize: "11px", fontWeight: 600, color: "#86efac", verticalAlign: "top", whiteSpace: "nowrap" }}>
                    📧 Newsletter PT
                  </td>
                  {[1,2,3,4,5,6,7].map((day) => (
                    <td key={day} style={{ padding: "2px" }}>
                      {day === 1 && plan.newsletter_draft_pt ? (
                        <div
                          onClick={() => setPreviewText({ title: "Newsletter PT", body: plan.newsletter_draft_pt! })}
                          style={{
                            minHeight: "54px",
                            borderRadius: "6px",
                            padding: "6px 8px",
                            background: "#1c1917",
                            border: "1px solid #4ade8033",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontSize: "11px", color: "#86efac", fontWeight: 500, marginBottom: "3px" }}>Ver draft →</div>
                          <div style={{ fontSize: "9px", color: "#57534e" }}>{scheduledLabel(weekStart, 0, "newsletter_pt")}</div>
                          <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: "#292524", color: "#a8a29e" }}>⏰ Pendiente</span>
                        </div>
                      ) : (
                        <ScheduleCell empty={day !== 1 || !plan.newsletter_draft_pt} />
                      )}
                    </td>
                  ))}
                </tr>

                {/* Buzz articles per language */}
                {(["es", "pt", "en"] as const).map((lang) => (
                  <tr key={`buzz-${lang}`}>
                    <td style={{ padding: "2px 8px 2px 0", fontSize: "11px", fontWeight: 600, verticalAlign: "top", whiteSpace: "nowrap", color: lang === "en" ? "#38bdf8" : lang === "pt" ? "#4ade80" : "#fb923c" }}>
                      📰 Buzz {lang.toUpperCase()}
                    </td>
                    {[1,2,3,4,5,6,7].map((day) => {
                      const art = articleForDay(lang, day);
                      return (
                        <td key={day} style={{ padding: "2px" }}>
                          <ScheduleCell
                            title={art?.title}
                            time={art ? scheduledLabel(weekStart, day - 1, `buzz_${lang}`) : undefined}
                            published={art?.is_published}
                            empty={!art}
                            color={lang === "en" ? "#0ea5e9" : lang === "pt" ? "#22c55e" : "#f97316"}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Carousels per theme */}
                {THEMES.map((theme) => (
                  <tr key={theme}>
                    <td style={{ padding: "2px 8px 2px 0", fontSize: "11px", fontWeight: 600, verticalAlign: "top", whiteSpace: "nowrap", color: THEME_COLORS[theme] }}>
                      {THEME_LABELS[theme]}
                    </td>
                    {[1,2,3,4,5,6,7].map((day) => {
                      const c = carouselForDay(theme, day);
                      return (
                        <td key={day} style={{ padding: "2px" }}>
                          <ScheduleCell
                            title={c?.hook_text}
                            time={c ? scheduledLabel(weekStart, day - 1, theme) : undefined}
                            published={c?.status === "published"}
                            empty={!c}
                            color={THEME_COLORS[theme]}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Pending creators ──────────────────────────────────────────────── */}
      {creators.length > 0 && (
        <div style={{ marginTop: "36px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#a78bfa", marginBottom: "12px" }}>
            👤 Solicitudes de Creator ({creators.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {creators.map((c) => (
              <div key={c.id} style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}>
                {c.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#6b7280" }}>
                    {(c.username ?? c.user_id).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>@{c.username ?? c.user_id.slice(0, 8)}</div>
                  {c.display_name && <div style={{ fontSize: "11px", color: "#6b7280" }}>{c.display_name}</div>}
                  <div style={{ fontSize: "10px", color: "#4b5563" }}>{formatDate(c.created_at)}</div>
                </div>
                {onApproveCreator && onRejectCreator && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => onApproveCreator(c.id, c.user_id)}
                      style={{ background: "#14532d", border: "1px solid #166534", borderRadius: "6px", padding: "5px 12px", color: "#86efac", cursor: "pointer", fontSize: "12px" }}
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => onRejectCreator(c.id, c.user_id)}
                      style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "6px", padding: "5px 12px", color: "#fca5a5", cursor: "pointer", fontSize: "12px" }}
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Newsletter preview modal ──────────────────────────────────────── */}
      {previewText && (
        <div
          onClick={() => setPreviewText(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1a1a1a", border: "1px solid #333", borderRadius: "12px",
              padding: "24px", maxWidth: "640px", width: "100%",
              maxHeight: "80vh", overflow: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>{previewText.title}</h3>
              <button
                onClick={() => setPreviewText(null)}
                style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "18px" }}
              >✕</button>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.6, color: "#d6d3d1", margin: 0 }}>
              {previewText.body}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
