"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

type WeekPlan = {
  week_key: string;
  week_start: string;
  week_end: string;
  status: string;
  newsletter_draft_es: string | null;
  newsletter_draft_pt: string | null;
};

type PublishedArticle = {
  id: number;
  title: string;
  summary: string | null;
  language: "es" | "pt" | "en";
  day_slot: number;
  category: string | null;
  source_url: string | null;
  body_html: string | null;
  image_url: string | null;
};

type PublishedCarousel = {
  id: string;
  theme_type: "actualidad" | "historia" | "reco" | "dato_peekr";
  day_slot: number;
  hook_text: string;
  bullet_points: string[] | null;
  caption: string | null;
  seed_title: string | null;
  seed_poster_url: string | null;
  source_label: string | null;
  language: string | null;
  slide_urls: string[] | null;
};

type PreviewContent =
  | { kind: "newsletter"; lang: "es" | "pt"; body: string }
  | { kind: "carousel"; carousel: PublishedCarousel }
  | { kind: "article"; article: PublishedArticle };

interface Props {
  supabase: SupabaseClient;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const THEMES = ["actualidad", "historia", "reco", "dato_peekr"] as const;
type ThemeType = (typeof THEMES)[number];

const THEME_LABELS: Record<ThemeType, string> = {
  actualidad: "📰 Actualidad",
  historia: "🎬 Historia",
  reco: "⭐ Recomendaciones",
  dato_peekr: "📊 Dato Peekr",
};

const THEME_COLORS: Record<ThemeType, string> = {
  actualidad: "#0ea5e9",
  historia: "#f97316",
  reco: "#22c55e",
  dato_peekr: "#a855f7",
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
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
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

function dayLabel(weekStart: Date, dayIndex: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Slide URL builder (same as page.tsx) ────────────────────────────────────

function buildSlideUrl(
  type: string,
  slide: 1 | 2 | 3 | 4 | 5,
  opts: { hook?: string | null; point?: string | null; img?: string | null; title?: string | null; source?: string | null; lang?: string | null }
) {
  const p = new URLSearchParams();
  p.set("type", type || "actualidad");
  p.set("slide", String(slide));
  if (opts.hook)   p.set("hook",   opts.hook.slice(0, 200));
  if (opts.point)  p.set("point",  opts.point.slice(0, 200));
  if (opts.img)    p.set("img",    opts.img);
  if (opts.title)  p.set("title",  opts.title.slice(0, 80));
  if (opts.source) p.set("source", opts.source.slice(0, 60));
  if (opts.lang)   p.set("lang",   opts.lang === "pt" ? "pt" : "es");
  return `/api/slides?${p.toString()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: "12px",
      fontWeight: 700,
      color: "#6b7280",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      padding: "10px 0 6px",
      borderBottom: "1px solid #1f1f1f",
      marginBottom: "8px",
    }}>
      {title}
    </div>
  );
}

function RowItem({
  label,
  title,
  color,
  active,
  onClick,
}: {
  label: string;
  title: string;
  color?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "8px 10px",
        borderRadius: "6px",
        cursor: "pointer",
        background: active ? "#1e1b4b" : "transparent",
        border: active ? "1px solid #4f46e5" : "1px solid transparent",
        transition: "background 0.1s",
      }}
    >
      <div style={{
        minWidth: "88px",
        fontSize: "10px",
        fontWeight: 600,
        color: color ?? "#6b7280",
        paddingTop: "1px",
        whiteSpace: "nowrap",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: "12px",
        color: "#d6d3d1",
        lineHeight: 1.4,
        flex: 1,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {title}
      </div>
      <div style={{ color: "#4b5563", fontSize: "11px", paddingTop: "1px", flexShrink: 0 }}>→</div>
    </div>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────────────

function PreviewPanel({ content, onClose }: { content: PreviewContent; onClose: () => void }) {
  const [activeSlide, setActiveSlide] = useState<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => { setActiveSlide(1); }, [content]);

  return (
    <div style={{
      position: "sticky",
      top: "80px",
      background: "#111",
      border: "1px solid #2a2a2a",
      borderRadius: "10px",
      padding: "16px",
      maxHeight: "calc(100vh - 120px)",
      overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontWeight: 700, fontSize: "13px", color: "#d0d0d0" }}>
          {content.kind === "newsletter" ? `Newsletter ${content.lang.toUpperCase()}` :
           content.kind === "carousel" ? THEME_LABELS[content.carousel.theme_type as ThemeType] :
           `Buzz ${content.article.language.toUpperCase()}`}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "16px" }}>✕</button>
      </div>

      {content.kind === "newsletter" && (
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", lineHeight: 1.7, color: "#d6d3d1", margin: 0 }}>
          {content.body}
        </pre>
      )}

      {content.kind === "article" && (
        <div>
          <div style={{ fontWeight: 700, fontSize: "14px", color: "#f5f5f4", marginBottom: "8px", lineHeight: 1.4 }}>
            {content.article.title}
          </div>
          {content.article.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.article.image_url}
              alt=""
              style={{ width: "100%", borderRadius: "6px", marginBottom: "10px", objectFit: "cover", maxHeight: "180px" }}
            />
          )}
          {content.article.summary && (
            <div style={{ fontSize: "12px", color: "#a8a29e", lineHeight: 1.6, marginBottom: "10px" }}>
              {content.article.summary}
            </div>
          )}
          {content.article.source_url && (
            <a
              href={content.article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "11px", color: "#6366f1", textDecoration: "none" }}
            >
              Ver artículo →
            </a>
          )}
        </div>
      )}

      {content.kind === "carousel" && (
        <div>
          {/* Slide preview */}
          {(() => {
            const c = content.carousel;
            const pts = c.bullet_points ?? [];
            const type = c.theme_type;
            const lang = c.language;

            // Use slide_urls if available, otherwise build from /api/slides
            const slideCount = 5;
            const urlFor = (slide: 1 | 2 | 3 | 4 | 5) =>
              c.slide_urls?.[slide - 1] ?? buildSlideUrl(type, slide, {
                hook: c.hook_text,
                point: slide === 2 ? pts[0] : slide === 3 ? pts[1] : slide === 4 ? pts[2] : pts[3],
                img: c.seed_poster_url,
                title: c.seed_title,
                source: c.source_label,
                lang,
              });

            return (
              <>
                <div style={{ borderRadius: "8px", overflow: "hidden", marginBottom: "8px", aspectRatio: "1", background: "#0a0a0a" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={activeSlide}
                    src={urlFor(activeSlide)}
                    alt={`Slide ${activeSlide}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                  />
                </div>
                {/* Slide thumbnails */}
                <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
                  {Array.from({ length: slideCount }, (_, i) => (i + 1) as 1 | 2 | 3 | 4 | 5).map((s) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={s}
                      src={urlFor(s)}
                      alt={`Slide ${s}`}
                      onClick={() => setActiveSlide(s)}
                      style={{
                        flex: 1,
                        aspectRatio: "1",
                        objectFit: "cover",
                        borderRadius: "4px",
                        cursor: "pointer",
                        border: activeSlide === s ? "2px solid #7c3aed" : "2px solid transparent",
                        opacity: activeSlide === s ? 1 : 0.5,
                      }}
                      loading="lazy"
                    />
                  ))}
                </div>
                {/* Hook + bullets */}
                <div style={{ fontSize: "12px", fontWeight: 700, color: THEME_COLORS[type as ThemeType], marginBottom: "6px" }}>
                  {c.hook_text}
                </div>
                {pts.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#a8a29e", lineHeight: 1.6 }}>
                    {pts.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
                {c.caption && (
                  <div style={{ marginTop: "10px", padding: "8px", background: "#1a1a1a", borderRadius: "6px", fontSize: "11px", color: "#78716c", lineHeight: 1.5 }}>
                    <div style={{ fontSize: "10px", color: "#4b5563", marginBottom: "4px", textTransform: "uppercase" }}>Caption</div>
                    {c.caption}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublishedArchiveTab({ supabase }: Props) {
  const [weekKey, setWeekKey] = useState<string>(() => {
    // Default to current week
    const now = new Date();
    const day = now.getDay();
    if (day === 6) { const n = new Date(now); n.setDate(n.getDate() + 2); return getWeekKey(n); }
    if (day === 0) { const n = new Date(now); n.setDate(n.getDate() + 1); return getWeekKey(n); }
    return getWeekKey(now);
  });

  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [articles, setArticles] = useState<PublishedArticle[]>([]);
  const [carousels, setCarousels] = useState<PublishedCarousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewContent | null>(null);

  const weekStart = getWeekStart(weekKey);
  const dayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setPreview(null);

    const [planRes, articlesRes, carouselsRes] = await Promise.all([
      supabase
        .from("weekly_editorial_plans")
        .select("week_key, week_start, week_end, status, newsletter_draft_es, newsletter_draft_pt")
        .eq("week_key", weekKey)
        .maybeSingle(),
      supabase
        .from("peekrbuzz_articles")
        .select("id, title, summary, language, day_slot, category, source_url, body_html, image_url")
        .eq("week_key", weekKey)
        .eq("article_status", "selected")
        .order("language")
        .order("day_slot"),
      supabase
        .from("peekrbuzz_ig_queue")
        .select("id, theme_type, day_slot, hook_text, bullet_points, caption, seed_title, seed_poster_url, source_label, language, slide_urls")
        .eq("week_key", weekKey)
        .in("status", ["approved", "published"])
        .order("day_slot"),
    ]);

    setPlan(planRes.data ?? null);
    setArticles((articlesRes.data as PublishedArticle[]) ?? []);
    setCarousels((carouselsRes.data as PublishedCarousel[]) ?? []);
    setLoading(false);
  }, [supabase, weekKey]);

  useEffect(() => { loadData(); }, [loadData]);

  function articlesForDay(day: number, lang: "es" | "pt" | "en") {
    return articles.find((a) => a.day_slot === day && a.language === lang) ?? null;
  }

  function carouselForDay(day: number, theme: ThemeType) {
    return carousels.find((c) => c.day_slot === day && c.theme_type === theme) ?? null;
  }

  const weekLabel = `${weekKey} · ${dayDates[0].toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${dayDates[6].toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`;

  const hasAnyContent = plan || articles.length > 0 || carousels.length > 0;

  return (
    <div style={{ color: "#e5e5e5", paddingBottom: "40px" }}>

      {/* ── Week navigation ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingTop: "8px" }}>
        <button
          onClick={() => setWeekKey((k) => shiftWeek(k, -1))}
          style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", padding: "6px 14px", color: "#e5e5e5", cursor: "pointer", fontSize: "13px" }}
        >
          ← Anterior
        </button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: "15px" }}>{weekLabel}</div>
        <button
          onClick={() => setWeekKey((k) => shiftWeek(k, 1))}
          style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", padding: "6px 14px", color: "#e5e5e5", cursor: "pointer", fontSize: "13px" }}
        >
          Siguiente →
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>Cargando…</div>
      ) : !hasAnyContent ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#6b7280", background: "#0f0f0f", borderRadius: "12px", border: "1px solid #1a1a1a" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: "6px" }}>Sin contenido para esta semana</div>
          <div style={{ fontSize: "12px" }}>Navega a semanas anteriores o espera que el pipeline genere la próxima.</div>
        </div>
      ) : (
        /* ── Two-column layout: list | preview ──────────────────────────── */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", alignItems: "start" }}>

          {/* ── LEFT: Content list ─────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>

            {/* Newsletter */}
            {(plan?.newsletter_draft_es || plan?.newsletter_draft_pt) && (
              <div>
                <SectionHeader title="📧 Newsletter" />
                {plan?.newsletter_draft_es && (
                  <RowItem
                    label="ES"
                    title="Newsletter semanal en español"
                    color="#c4b5fd"
                    active={preview?.kind === "newsletter" && (preview as { lang: string }).lang === "es"}
                    onClick={() => setPreview({ kind: "newsletter", lang: "es", body: plan.newsletter_draft_es! })}
                  />
                )}
                {plan?.newsletter_draft_pt && (
                  <RowItem
                    label="PT"
                    title="Newsletter semanal em português"
                    color="#86efac"
                    active={preview?.kind === "newsletter" && (preview as { lang: string }).lang === "pt"}
                    onClick={() => setPreview({ kind: "newsletter", lang: "pt", body: plan.newsletter_draft_pt! })}
                  />
                )}
              </div>
            )}

            {/* Carousels */}
            {carousels.length > 0 && (
              <div>
                <SectionHeader title="📱 Carruseles (IG · Threads · FB · BSKY)" />
                {[1,2,3,4,5,6,7].map((day) => {
                  const dayItems = THEMES
                    .map((theme) => ({ theme, c: carouselForDay(day, theme) }))
                    .filter((x) => x.c !== null);
                  if (dayItems.length === 0) return null;
                  return (
                    <div key={day} style={{ marginBottom: "4px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 600, color: "#4b5563", padding: "4px 10px 2px", textTransform: "uppercase" }}>
                        {DAYS_ES[day - 1]} · {dayLabel(weekStart, day - 1)}
                      </div>
                      {dayItems.map(({ theme, c }) => (
                        <RowItem
                          key={theme}
                          label={THEME_LABELS[theme]}
                          title={c!.hook_text}
                          color={THEME_COLORS[theme]}
                          active={preview?.kind === "carousel" && (preview as { carousel: PublishedCarousel }).carousel.id === c!.id}
                          onClick={() => setPreview({ kind: "carousel", carousel: c! })}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* PeekrBuzz articles */}
            {articles.length > 0 && (
              <div>
                <SectionHeader title="📰 PeekrBuzz" />
                {[1,2,3,4,5,6,7].map((day) => {
                  const dayArticles = (["es", "pt", "en"] as const)
                    .map((lang) => ({ lang, a: articlesForDay(day, lang) }))
                    .filter((x) => x.a !== null);
                  if (dayArticles.length === 0) return null;
                  return (
                    <div key={day} style={{ marginBottom: "4px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 600, color: "#4b5563", padding: "4px 10px 2px", textTransform: "uppercase" }}>
                        {DAYS_ES[day - 1]} · {dayLabel(weekStart, day - 1)}
                      </div>
                      {dayArticles.map(({ lang, a }) => (
                        <RowItem
                          key={lang}
                          label={lang.toUpperCase()}
                          title={a!.title}
                          color={lang === "en" ? "#38bdf8" : lang === "pt" ? "#4ade80" : "#fb923c"}
                          active={preview?.kind === "article" && (preview as { article: PublishedArticle }).article.id === a!.id}
                          onClick={() => setPreview({ kind: "article", article: a! })}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* ── RIGHT: Preview panel ──────────────────────────────────── */}
          <div>
            {preview ? (
              <PreviewPanel content={preview} onClose={() => setPreview(null)} />
            ) : (
              <div style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "#4b5563",
                background: "#0f0f0f",
                border: "1px dashed #1f1f1f",
                borderRadius: "10px",
                fontSize: "12px",
              }}>
                Seleccioná un item<br />para ver el preview
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
