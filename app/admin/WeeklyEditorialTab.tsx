"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

// Articles can carry all 4 themes; carousels are now only generated for 2 of them.
type ArticleTheme = "actualidad" | "historia" | "reco" | "dato_peekr";

type WeeklyPlan = {
  id: string;
  week_key: string;
  week_start: string;
  week_end: string;
  status:
    | "generating"
    | "ready"
    | "in_review"
    | "approved"
    | "publishing"
    | "published";
  articles_es_count: number;
  articles_pt_count: number;
  articles_en_count: number;
  carousels_count: number;
  newsletter_draft_es: string | null;
  newsletter_draft_pt: string | null;
  newsletter_prompt: string | null;
  generated_at: string | null;
};

type BuzzArticle = {
  id: number;
  title: string;
  summary: string | null;
  language: "es" | "pt" | "en";
  editorial_theme: ArticleTheme | null;
  week_key: string;
  day_slot: number | null;
  article_status: "draft_option" | "selected";
  image_url: string | null;
};

type CarouselOption = {
  id: string;
  week_key: string;
  day_slot: number;
  theme_type: "actualidad" | "historia" | "reco" | "dato_peekr";
  option_index: number;
  hook_text: string;
  bullet_points: string[];
  caption: string;
  seed_title: string | null;
  article_url: string | null;
  seed_poster_url: string | null;
  status: "pending_review" | "approved";
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface WeeklyEditorialTabProps {
  supabase: SupabaseClient;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const THEMES = ["actualidad", "historia"] as const;
type ThemeType = (typeof THEMES)[number];

const THEME_LABELS: Record<ThemeType, string> = {
  actualidad: "Actualidad",
  historia:   "Historia",
};

const THEME_ICONS: Record<ThemeType, string> = {
  actualidad: "📰",
  historia:   "🎬",
};

const THEME_COLORS: Record<ThemeType, string> = {
  actualidad: "#0ea5e9",
  historia:   "#f59e0b",
};

// Articles: user selects 7 ES; EN+PT are auto-translated from the selected ES articles.
const ARTICLE_ES_TARGET = 7;

// UTC hour at which each theme's carousel is published
const CAROUSEL_PUBLISH_HOURS: Record<string, number> = {
  actualidad: 13,
  historia:   15,
  reco:       14,
};

/** Returns the ISO scheduled_for string for a given day_slot + theme.
 *  If the computed time is already in the past, returns now so the cron
 *  publishes on the next run rather than scheduling all future slots
 *  at once when the admin approves the full week. */
function computeScheduledFor(weekStart: string, daySlot: number, themeType: string): string {
  const hour = CAROUSEL_PUBLISH_HOURS[themeType] ?? 13;
  const base = new Date(`${weekStart}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + (daySlot - 1));
  base.setUTCHours(hour, 0, 0, 0);
  const now = new Date();
  return (base <= now ? now : base).toISOString();
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

function isoWeekKey(date: Date): string {
  // Correct ISO 8601 week number: week containing the nearest Thursday.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Shift to Thursday of the same ISO week (Mon=1..Sun=7 → Thu=4)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getTargetWeekKey(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const target = new Date(now);
  // On Sat/Sun show the coming week so the plan is always the next publishing week
  if (dayOfWeek === 6) target.setDate(now.getDate() + 2); // Sat → next Mon
  else if (dayOfWeek === 0) target.setDate(now.getDate() + 1); // Sun → next Mon
  return isoWeekKey(target);
}

function getWeekLabel(weekKey: string): string {
  // Parse ISO week key → Monday date
  const [yearStr, wStr] = weekKey.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);
  // Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4);
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const monday = new Date(mondayOfWeek1);
  monday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const monthNames = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ];
  const startDay = monday.getDate();
  const endDay = sunday.getDate();
  const endMonth = monthNames[sunday.getMonth()];
  const endYear = sunday.getFullYear();

  if (monday.getMonth() === sunday.getMonth()) {
    return `${startDay}–${endDay} de ${endMonth} ${endYear}`;
  }
  const startMonth = monthNames[monday.getMonth()];
  return `${startDay} de ${startMonth} – ${endDay} de ${endMonth} ${endYear}`;
}

// ─── Newsletter email preview helpers ─────────────────────────────────────────

/** Converts the Gemini-generated Markdown newsletter into basic inline-styled HTML
 *  suitable for rendering inside a preview div (no CSS classes needed). */
function markdownToHtml(md: string): string {
  return md
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("## ")) {
        return `<h2 style="font-size:17px;font-weight:700;color:#111827;margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #FA0082;">${trimmed.slice(3)}</h2>`;
      }
      if (trimmed.startsWith("# ")) {
        return `<h1 style="font-size:20px;font-weight:800;color:#111827;margin:0 0 14px;">${trimmed.slice(2)}</h1>`;
      }
      const withBold = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#1f2937;">$1</strong>');
      const withBreaks = withBold.replace(/\n/g, "<br>");
      return `<p style="font-size:15px;line-height:1.75;color:#374151;margin:0 0 14px;">${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WeeklyPlan["status"] }) {
  const cfg: Record<
    WeeklyPlan["status"],
    { label: string; color: string; bg: string }
  > = {
    generating: { label: "Generando contenido…", color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
    ready:      { label: "Listo para revisar",   color: "#4ade80", bg: "rgba(74,222,128,0.15)" },
    in_review:  { label: "En revisión",           color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
    approved:   { label: "Aprobado",              color: "#818cf8", bg: "rgba(129,140,248,0.15)" },
    publishing: { label: "Publicando…",           color: "#f472b6", bg: "rgba(244,114,182,0.15)" },
    published:  { label: "Publicado ✅",           color: "#4ade80", bg: "rgba(74,222,128,0.15)" },
  };
  const c = cfg[status] ?? cfg.ready;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.color}40`,
      }}
    >
      {c.label}
    </span>
  );
}

const ARTICLE_THEME_COLORS: Record<ArticleTheme, string> = {
  actualidad: "#0ea5e9",
  dato_peekr: "#FA0082",
  historia:   "#f59e0b",
  reco:       "#10b981",
};
const ARTICLE_THEME_LABELS: Record<ArticleTheme, string> = {
  actualidad: "Actualidad",
  dato_peekr: "Dato Peekr",
  historia:   "Historia",
  reco:       "Reco",
};

function ThemeBadge({ theme }: { theme: ArticleTheme | null }) {
  if (!theme) return null;
  const color = ARTICLE_THEME_COLORS[theme] ?? "#888";
  const label = ARTICLE_THEME_LABELS[theme] ?? theme;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 8,
        fontSize: 10,
        fontWeight: 700,
        color,
        background: `${color}22`,
        border: `1px solid ${color}44`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </span>
  );
}

function ProgressBar({
  value,
  max,
  color = "#FA0082",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      style={{
        height: 6,
        borderRadius: 3,
        background: "#2a2a2a",
        overflow: "hidden",
        flex: 1,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 12,
          width: "min(860px, 100%)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 700, color: "#f0f0f0" }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: 20, flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Carousel Option Card ─────────────────────────────────────────────────────

function CarouselOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: CarouselOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Defensive: bullet_points may come from DB as an object if Gemini returned malformed JSON
  const rawBullets = option.bullet_points as unknown;
  const bullets: string[] = Array.isArray(rawBullets)
    ? (rawBullets as unknown[]).map((b) =>
        typeof b === "string" ? b : JSON.stringify(b)
      )
    : rawBullets !== null && typeof rawBullets === "object"
    ? Object.values(rawBullets as Record<string, unknown>).map((v) =>
        typeof v === "string" ? v : JSON.stringify(v)
      )
    : [];
  const visibleBullets = expanded ? bullets : bullets.slice(0, 2);

  return (
    <div
      onClick={onSelect}
      style={{
        background: "#111",
        border: `2px solid ${selected ? "#FA0082" : "#2a2a2a"}`,
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        position: "relative",
        transition: "border-color 0.15s",
        flex: 1,
        minWidth: 0,
      }}
    >
      {selected && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            color: "#FA0082",
            fontSize: 14,
            fontWeight: 900,
          }}
        >
          ✓
        </div>
      )}
      {option.seed_poster_url && (
        <img
          src={option.seed_poster_url}
          alt=""
          style={{ width: "100%", height: 60, objectFit: "cover", borderRadius: 4, marginBottom: 6 }}
        />
      )}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#f0f0f0",
          lineHeight: 1.3,
          marginBottom: 6,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {option.hook_text}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {visibleBullets.map((b, i) => (
          <div
            key={i}
            style={{
              fontSize: 10,
              color: "#aaa",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            • {b}
          </div>
        ))}
      </div>
      {bullets.length > 2 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          style={{
            background: "none",
            border: "none",
            color: "#FA0082",
            fontSize: 10,
            cursor: "pointer",
            padding: "4px 0 0",
            display: "block",
          }}
        >
          {expanded ? "Ver menos ▲" : `Ver más ▼ (+${bullets.length - 2})`}
        </button>
      )}
      {option.caption && (
        <div
          style={{
            marginTop: 6,
            fontSize: 9,
            color: "#666",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            borderTop: "1px solid #222",
            paddingTop: 4,
          }}
        >
          {option.caption}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeeklyEditorialTab({
  supabase,
}: WeeklyEditorialTabProps) {
  const weekKey = useMemo(() => getTargetWeekKey(), []);
  const weekLabel = useMemo(() => getWeekLabel(weekKey), [weekKey]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [buzzArticles, setBuzzArticles] = useState<BuzzArticle[]>([]);
  const [carouselOptions, setCarouselOptions] = useState<CarouselOption[]>([]);
  const [newsletterPreviewOpen, setNewsletterPreviewOpen] = useState<
    "es" | "pt" | null
  >(null);
  const [newsletterPromptEs, setNewsletterPromptEs] = useState("");
  const [newsletterPromptPt, setNewsletterPromptPt] = useState("");
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [newsletterRegenLoading, setNewsletterRegenLoading] = useState<
    "es" | "pt" | null
  >(null);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testSentMsg, setTestSentMsg] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // ── Derived selection state ────────────────────────────────────────────────
  const [selectedEsIds, setSelectedEsIds] = useState<Set<number>>(new Set());
  // Keep legacy shape for remaining code that refs selectedArticleIds
  const selectedArticleIds = { es: selectedEsIds, pt: new Set<number>(), en: new Set<number>() };

  // key = `${day_slot}-${theme_type}`, value = carousel option id
  const [selectedCarouselMap, setSelectedCarouselMap] = useState<
    Map<string, string>
  >(new Map());

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, articlesRes, carouselsRes] = await Promise.all([
        supabase
          .from("weekly_editorial_plans")
          .select("*")
          .eq("week_key", weekKey)
          .maybeSingle(),
        supabase
          .from("peekrbuzz_articles")
          .select(
            "id,title,summary,language,editorial_theme,week_key,day_slot,article_status,image_url"
          )
          .eq("week_key", weekKey)
          .in("article_status", ["draft_option", "selected"]),
        supabase
          .from("peekrbuzz_ig_queue")
          .select(
            "id,week_key,day_slot,theme_type,option_index,hook_text,bullet_points,caption,seed_title,article_url,status,seed_poster_url"
          )
          .eq("week_key", weekKey)
          .in("theme_type", ["actualidad", "historia", "reco"])
          .in("status", ["pending_review", "approved"]),
      ]);

      if (planRes.error) throw new Error(`weekly_editorial_plans: ${planRes.error.message}`);
      if (articlesRes.error) throw new Error(`peekrbuzz_articles: ${articlesRes.error.message}`);
      if (carouselsRes.error) throw new Error(`peekrbuzz_ig_queue: ${carouselsRes.error.message}`);

      const planData = planRes.data as WeeklyPlan | null;
      const articles = (articlesRes.data ?? []) as BuzzArticle[];
      const carousels = (carouselsRes.data ?? []) as CarouselOption[];

      setPlan(planData);
      setBuzzArticles(articles);
      setCarouselOptions(carousels);

      if (planData) {
        setNewsletterPromptEs(planData.newsletter_prompt ?? "");
        setNewsletterPromptPt(planData.newsletter_prompt ?? "");
      }

      // Rebuild selection state from DB (only ES articles are user-selected)
      const es = new Set<number>();
      for (const a of articles) {
        if (a.article_status === "selected" && a.language === "es") es.add(a.id);
      }
      setSelectedEsIds(es);

      const carouselMap = new Map<string, string>();
      for (const c of carousels) {
        if (c.status === "approved") {
          carouselMap.set(`${c.day_slot}-${c.theme_type}`, c.id);
        }
      }
      setSelectedCarouselMap(carouselMap);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [supabase, weekKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Regenerate week ────────────────────────────────────────────────────────
  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate_weekly_buzz`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ week_key: weekKey }),
        }
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Error ${res.status}: ${body}`);
      }
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error regenerando");
    } finally {
      setRegenerating(false);
    }
  }

  // ── Translate selected ES articles to EN+PT ────────────────────────────────
  async function handleTranslate() {
    setTranslating(true);
    setTranslateMsg(null);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate_weekly_buzz`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: "translate", week_key: weekKey }),
        }
      );
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      const data = await res.json() as { translated?: number };
      setTranslateMsg(`✓ ${data.translated ?? 0} artículos traducidos (EN + PT)`);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error traduciendo artículos");
    } finally {
      setTranslating(false);
    }
  }

  // ── Toggle article selection (ES only) ────────────────────────────────────
  async function handleArticleToggle(article: BuzzArticle) {
    const lang = article.language as "es" | "pt" | "en";
    const currentSet = new Set(selectedArticleIds[lang]);
    const isSelected = currentSet.has(article.id);
    const target = lang === "es" ? ARTICLE_ES_TARGET : 0;

    if (!isSelected && currentSet.size >= target) return; // cap reached

    const newStatus: BuzzArticle["article_status"] = isSelected
      ? "draft_option"
      : "selected";

    if (isSelected) {
      currentSet.delete(article.id);
    } else {
      currentSet.add(article.id);
    }

    // Compute day_slot based on position in selected set
    let daySlot: number | null = null;
    if (!isSelected) {
      const selectedArray = Array.from(currentSet);
      const pos = selectedArray.indexOf(article.id);
      const dotsPerDay = lang === "en" ? 1 : 2;
      daySlot = Math.floor(pos / dotsPerDay) + 1;
    }

    if (lang === "es") setSelectedEsIds(new Set(currentSet));

    // Recompute day_slots for all selected in this lang
    const updatedArticles = buzzArticles.map((a) => {
      if (a.language !== lang) return a;
      if (a.id === article.id) {
        return { ...a, article_status: newStatus, day_slot: daySlot };
      }
      if (currentSet.has(a.id)) {
        const dotsPerDay = lang === "en" ? 1 : 2;
        const selectedArr = Array.from(currentSet);
        const idx = selectedArr.indexOf(a.id);
        return { ...a, day_slot: Math.floor(idx / dotsPerDay) + 1 };
      }
      return a;
    });
    setBuzzArticles(updatedArticles);

    setSaving(true);
    try {
      await supabase
        .from("peekrbuzz_articles")
        .update({ article_status: newStatus, day_slot: daySlot })
        .eq("id", article.id);

      // Rewrite day_slots in bulk for currently selected articles of this lang
      const dotsPerDay = lang === "en" ? 1 : 2;
      const ops = Array.from(currentSet).map((id, idx) =>
        supabase
          .from("peekrbuzz_articles")
          .update({ day_slot: Math.floor(idx / dotsPerDay) + 1 })
          .eq("id", id)
      );
      await Promise.all(ops);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error actualizando");
    } finally {
      setSaving(false);
    }
  }

  // ── Select carousel option ─────────────────────────────────────────────────
  async function handleCarouselSelect(option: CarouselOption) {
    const key = `${option.day_slot}-${option.theme_type}`;
    const alreadySelected = selectedCarouselMap.get(key) === option.id;

    const newMap = new Map(selectedCarouselMap);
    if (alreadySelected) {
      newMap.delete(key);
    } else {
      newMap.set(key, option.id);
    }
    setSelectedCarouselMap(newMap);

    setSaving(true);
    try {
      // Reset all options for same day/theme (clear scheduled_for too)
      const sameGroup = carouselOptions.filter(
        (c) => c.day_slot === option.day_slot && c.theme_type === option.theme_type
      );
      await Promise.all(
        sameGroup.map((c) =>
          supabase
            .from("peekrbuzz_ig_queue")
            .update({ status: "pending_review", scheduled_for: null })
            .eq("id", c.id)
        )
      );
      if (!alreadySelected) {
        const scheduledFor = plan?.week_start
          ? computeScheduledFor(plan.week_start, option.day_slot, option.theme_type)
          : new Date().toISOString();
        await supabase
          .from("peekrbuzz_ig_queue")
          .update({ status: "approved", scheduled_for: scheduledFor })
          .eq("id", option.id);
      }
      // Update local state
      setCarouselOptions((prev) =>
        prev.map((c) => {
          if (c.day_slot !== option.day_slot || c.theme_type !== option.theme_type)
            return c;
          return {
            ...c,
            status:
              !alreadySelected && c.id === option.id
                ? "approved"
                : "pending_review",
          };
        })
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error actualizando carousel");
    } finally {
      setSaving(false);
    }
  }

  // ── Newsletter regeneration ────────────────────────────────────────────────
  async function handleNewsletterRegen(lang: "es" | "pt") {
    setNewsletterRegenLoading(lang);
    setError(null);
    const prompt = lang === "es" ? newsletterPromptEs : newsletterPromptPt;
    try {
      // Save prompt first
      if (plan) {
        await supabase
          .from("weekly_editorial_plans")
          .update({ newsletter_prompt: prompt })
          .eq("week_key", weekKey);
      }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate_weekly_buzz`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: "newsletter", lang, prompt, week_key: weekKey }),
        }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error regenerando newsletter");
    } finally {
      setNewsletterRegenLoading(null);
    }
  }

  // ── Approve week ───────────────────────────────────────────────────────────
  async function handleApproveWeek() {
    setSaving(true);
    setError(null);
    try {
      await supabase
        .from("weekly_editorial_plans")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("week_key", weekKey);
      setApproved(true);
      setPlan((prev) => (prev ? { ...prev, status: "approved" } : prev));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error aprobando semana");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadPreview(lang: "es" | "pt") {
    setLoadingPreview(true);
    setPreviewHtml(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/admin/newsletter/preview?lang=${lang}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPreviewHtml(await res.text());
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSendTest(lang: "es" | "pt") {
    setSendingTest(true);
    setTestSentMsg(null);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError("No hay sesión activa"); return; }

      const res = await fetch("/api/admin/newsletter/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: "jmartinellir@gmail.com", lang }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as any).error ?? `Error ${res.status}`);
        return;
      }
      setTestSentMsg(`✓ Prueba enviada a jmartinellir@gmail.com (${lang.toUpperCase()})`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error enviando prueba");
    } finally {
      setSendingTest(false);
    }
  }

  // ── Completion checks ──────────────────────────────────────────────────────
  const esCount = selectedEsIds.size;
  // EN+PT translation status from DB
  const enTranslated = buzzArticles.filter(a => a.language === "en").length;
  const ptTranslated = buzzArticles.filter(a => a.language === "pt").length;

  const actualidadSelected = [...selectedCarouselMap.keys()].filter(k => k.endsWith("-actualidad")).length;
  const historiaSelected   = [...selectedCarouselMap.keys()].filter(k => k.endsWith("-historia")).length;
  const recoSelected       = selectedCarouselMap.has("4-reco") ? 1 : 0;
  const carouselSelectedCount = selectedCarouselMap.size;
  const carouselTarget = 7 + 7 + 1; // 15 total: 7 actualidad + 7 historia + 1 reco

  const hasNewsletterEs = !!(plan?.newsletter_draft_es);
  const hasNewsletterPt = !!(plan?.newsletter_draft_pt);

  const allComplete =
    esCount >= ARTICLE_ES_TARGET &&
    enTranslated > 0 &&
    ptTranslated > 0 &&
    actualidadSelected >= 7 &&
    historiaSelected   >= 7 &&
    recoSelected       >= 1 &&
    hasNewsletterEs &&
    hasNewsletterPt;

  // ── Helpers for grid ───────────────────────────────────────────────────────
  function getArticlesForDayLang(
    day: number,
    lang: "es" | "pt" | "en"
  ): BuzzArticle[] {
    return buzzArticles.filter(
      (a) =>
        a.language === lang &&
        a.day_slot === day &&
        a.article_status === "selected"
    );
  }

  function getCarouselForDayTheme(
    day: number,
    theme: ThemeType
  ): CarouselOption | undefined {
    return carouselOptions.find(
      (c) =>
        c.day_slot === day &&
        c.theme_type === theme &&
        c.status === "approved"
    );
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderGridCell(content: string | null) {
    const filled = !!content;
    return (
      <div
        style={{
          padding: "4px 8px",
          fontSize: 11,
          color: filled ? "#d0d0d0" : "#444",
          borderLeft: filled ? "3px solid #FA008255" : "3px solid transparent",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          lineHeight: 1.3,
          minHeight: 30,
        }}
      >
        {content ?? "—"}
      </div>
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
        }}
      >
        <div style={{ color: "#888", fontSize: 16 }}>Cargando semana editorial…</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#FA0082",
                opacity: 0.4 + i * 0.2,
                animation: `pulse ${i * 0.3 + 0.6}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Generating banner ──────────────────────────────────────────────────────
  const isGenerating = !plan || plan.status === "generating";

  // ── Article count (ES options available) ──────────────────────────────────
  const esOptions = buzzArticles.filter((a) => a.language === "es").length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
        paddingBottom: 60,
      }}
    >
      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 8,
            padding: "10px 16px",
            color: "#fca5a5",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>⚠ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 1. HEADER ────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0" }}>
              Semana Editorial
            </span>
            <span style={{ fontSize: 13, color: "#888" }}>{weekKey}</span>
            {plan && <StatusBadge status={plan.status} />}
            {saving && (
              <span style={{ fontSize: 11, color: "#FA0082" }}>Guardando…</span>
            )}
          </div>
          <div style={{ fontSize: 15, color: "#bbb", fontWeight: 600 }}>
            {weekLabel}
          </div>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          style={{
            background: regenerating ? "#2a2a2a" : "rgba(124,58,237,0.15)",
            border: "1px solid rgba(124,58,237,0.4)",
            borderRadius: 8,
            padding: "8px 18px",
            color: regenerating ? "#666" : "#ff80bf",
            fontSize: 13,
            fontWeight: 600,
            cursor: regenerating ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {regenerating ? "⏳ Regenerando…" : "🔄 Regenerar"}
        </button>
      </div>

      {/* ── Generating banner ─────────────────────────────────────────── */}
      {isGenerating && (
        <div
          style={{
            background: "rgba(251,191,36,0.1)",
            border: "1px solid rgba(251,191,36,0.35)",
            borderRadius: 10,
            padding: "14px 20px",
            color: "#fbbf24",
            fontSize: 14,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>⏳</span>
          <span>
            Generando contenido… el dashboard estará listo el domingo a las 7am.
            Podés volver más tarde o presionar Regenerar para forzar.
          </span>
        </div>
      )}

      {/* ── 2. WEEKLY GRID ───────────────────────────────────────────── */}
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #2a2a2a",
            fontSize: 13,
            fontWeight: 700,
            color: "#d0d0d0",
          }}
        >
          Vista Semanal
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <colgroup>
              <col style={{ width: 130 }} />
              {DAYS_ES.map((d) => (
                <col key={d} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  style={{
                    padding: "8px 10px",
                    background: "#111",
                    borderBottom: "1px solid #2a2a2a",
                    textAlign: "left",
                    fontSize: 11,
                    color: "#666",
                    fontWeight: 600,
                  }}
                >
                  Categoría
                </th>
                {DAYS_ES.map((d) => (
                  <th
                    key={d}
                    style={{
                      padding: "8px 6px",
                      background: "#111",
                      borderBottom: "1px solid #2a2a2a",
                      textAlign: "center",
                      fontSize: 11,
                      color: "#888",
                      fontWeight: 700,
                    }}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* PeekrBuzz ES row */}
              <tr style={{ borderBottom: "1px solid #1f1f1f" }}>
                <td style={{ padding: "6px 10px", fontSize: 11, color: "#aaa", fontWeight: 700, background: "#161616", whiteSpace: "nowrap" }}>
                  PeekrBuzz{" "}
                  <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800, background: "rgba(239,68,68,0.2)", color: "#f87171" }}>
                    ES
                  </span>
                </td>
                {DAYS_ES.map((_, dayIdx) => {
                  const day = dayIdx + 1;
                  const art = getArticlesForDayLang(day, "es")[0];
                  return (
                    <td key={day} style={{ padding: "2px 2px", verticalAlign: "top", borderLeft: "1px solid #1f1f1f" }}>
                      {renderGridCell(art?.title ?? null)}
                    </td>
                  );
                })}
              </tr>
              {/* Reco row (Thursday only) */}
              <tr style={{ borderBottom: "1px solid #1f1f1f" }}>
                <td style={{ padding: "6px 10px", fontSize: 11, color: "#10b981", fontWeight: 700, background: "#161616", whiteSpace: "nowrap" }}>
                  🎯 Reco Jue
                </td>
                {DAYS_ES.map((_, dayIdx) => {
                  const day = dayIdx + 1;
                  const opt = day === 4 ? getCarouselForDayTheme(4, "actualidad") : null; // reuse helper, but pull reco
                  const recoOpt = day === 4 ? carouselOptions.find(c => c.day_slot === 4 && c.theme_type === "reco" && c.status === "approved") : null;
                  return (
                    <td key={day} style={{ padding: "2px 2px", verticalAlign: "top", borderLeft: "1px solid #1f1f1f" }}>
                      {renderGridCell(day === 4 ? (recoOpt?.hook_text ?? null) : null)}
                    </td>
                  );
                })}
              </tr>
              {/* Carousel theme rows */}
              {THEMES.map((theme) => (
                <tr key={`row-${theme}`} style={{ borderBottom: "1px solid #1f1f1f" }}>
                  <td
                    style={{
                      padding: "6px 10px",
                      fontSize: 11,
                      color: THEME_COLORS[theme],
                      fontWeight: 700,
                      background: "#161616",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {THEME_ICONS[theme]} {THEME_LABELS[theme]}
                  </td>
                  {DAYS_ES.map((_, dayIdx) => {
                    const day = dayIdx + 1;
                    const opt = getCarouselForDayTheme(day, theme);
                    return (
                      <td
                        key={day}
                        style={{
                          padding: "2px 2px",
                          verticalAlign: "top",
                          borderLeft: "1px solid #1f1f1f",
                        }}
                      >
                        {renderGridCell(opt?.hook_text ?? null)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. CANALES DE PUBLICACIÓN ────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#d0d0d0", marginBottom: 14, paddingLeft: 2 }}>
          Canales de Publicación
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            {
              icon: "📸",
              name: "Instagram",
              handle: "@peekr.app",
              freq: "2 posts diarios + reco jueves",
              detail: "Actualidad 13:00 UTC · Historia 15:00 UTC · Reco carrusel los jueves 14:00 UTC",
              color: "#e1306c",
            },
            {
              icon: "🧵",
              name: "Threads",
              handle: "@peekr.app",
              freq: "2 posts diarios + reco jueves",
              detail: "Mismo contenido que IG — publicación simultánea",
              color: "#888",
            },
            {
              icon: "📘",
              name: "Facebook",
              handle: "Peekr",
              freq: "2 posts diarios + reco jueves",
              detail: "Actualidad · Historia · Reco semanal",
              color: "#1877f2",
            },
            {
              icon: "🦋",
              name: "Bluesky",
              handle: "@peekr.app",
              freq: "2 posts diarios + reco jueves",
              detail: "Actualidad · Historia · Reco semanal",
              color: "#0085ff",
            },
            {
              icon: "📰",
              name: "PeekrBuzz ES",
              handle: "peekr.app/buzz",
              freq: "1 artículo/día · 7 artículos/semana",
              detail: "Seleccionados manualmente · traducidos automáticamente a EN y PT",
              color: "#f97316",
            },
            {
              icon: "📰",
              name: "PeekrBuzz EN + PT",
              handle: "peekr.app/buzz",
              freq: "Auto-traducción de los 7 ES seleccionados",
              detail: "Traducidos por Gemini desde los artículos ES aprobados",
              color: "#4ade80",
            },
            {
              icon: "📧",
              name: "Newsletter ES",
              handle: "email",
              freq: "1 por semana · lunes 08:00 UTC",
              detail: "Enviado a todos los usuarios registrados en español",
              color: "#ff80bf",
            },
            {
              icon: "📧",
              name: "Newsletter PT",
              handle: "email",
              freq: "1 por semana · lunes 08:00 UTC",
              detail: "Enviado a todos os usuários registrados em português",
              color: "#86efac",
            },
          ].map((ch) => (
            <div key={ch.name} style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#111",
              border: `1px solid ${ch.color}22`,
              borderRadius: 8,
              padding: "10px 14px",
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{ch.icon}</span>
              <div style={{ minWidth: 130, flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: ch.color }}>{ch.name}</div>
                <div style={{ fontSize: 11, color: "#57534e" }}>{ch.handle}</div>
              </div>
              <div style={{
                background: ch.color + "18",
                border: `1px solid ${ch.color}33`,
                borderRadius: 4,
                padding: "2px 8px",
                fontSize: 11,
                color: ch.color,
                fontWeight: 600,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
                {ch.freq}
              </div>
              <div style={{ fontSize: 11, color: "#78716c", lineHeight: 1.4 }}>
                {ch.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. NEWSLETTER ────────────────────────────────────────────── */}
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#d0d0d0",
            marginBottom: 14,
            paddingLeft: 2,
          }}
        >
          Newsletter
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {(["es", "pt"] as const).map((lang) => {
            const draft =
              lang === "es" ? plan?.newsletter_draft_es : plan?.newsletter_draft_pt;
            const prompt = lang === "es" ? newsletterPromptEs : newsletterPromptPt;
            const setPrompt =
              lang === "es" ? setNewsletterPromptEs : setNewsletterPromptPt;
            const isRegening = newsletterRegenLoading === lang;

            return (
              <div
                key={lang}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 12,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{ fontWeight: 700, color: "#d0d0d0", fontSize: 14 }}
                  >
                    Newsletter{" "}
                    <span
                      style={{
                        display: "inline-block",
                        padding: "1px 7px",
                        borderRadius: 4,
                        fontSize: 10,
                        background:
                          lang === "es"
                            ? "rgba(239,68,68,0.2)"
                            : "rgba(34,197,94,0.2)",
                        color: lang === "es" ? "#f87171" : "#4ade80",
                        fontWeight: 800,
                      }}
                    >
                      {lang.toUpperCase()}
                    </span>
                  </span>
                  {draft && (
                    <button
                      onClick={() => setNewsletterPreviewOpen(lang)}
                      style={{
                        background: "rgba(124,58,237,0.15)",
                        border: "1px solid rgba(124,58,237,0.4)",
                        borderRadius: 6,
                        padding: "4px 10px",
                        color: "#ff80bf",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      👁 Preview
                    </button>
                  )}
                </div>

                {draft ? (
                  <div
                    style={{
                      background: "#111",
                      border: "1px solid #2a2a2a",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#999",
                      lineHeight: 1.5,
                      maxHeight: 80,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {draft.slice(0, 200)}
                    {draft.length > 200 && (
                      <span style={{ color: "#555" }}>…</span>
                    )}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 30,
                        background:
                          "linear-gradient(transparent, #111)",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      background: "#111",
                      border: "1px dashed #333",
                      borderRadius: 8,
                      padding: "14px 12px",
                      fontSize: 12,
                      color: "#555",
                      textAlign: "center",
                    }}
                  >
                    Sin borrador todavía
                  </div>
                )}

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#666",
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    Instrucciones para regenerar
                  </div>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    placeholder="Ej: Tono más casual, enfocarse en series de ciencia ficción…"
                    style={{
                      width: "100%",
                      background: "#0d0d0d",
                      border: "1px solid #444",
                      borderRadius: 8,
                      padding: "9px 11px",
                      color: "#e0e0e0",
                      fontSize: 12,
                      resize: "vertical",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      outline: "none",
                      display: "block",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#FA0082"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#444"; }}
                  />
                </div>

                <button
                  onClick={() => handleNewsletterRegen(lang)}
                  disabled={isRegening}
                  style={{
                    background: isRegening
                      ? "#2a2a2a"
                      : "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.4)",
                    borderRadius: 8,
                    padding: "7px 14px",
                    color: isRegening ? "#666" : "#ff80bf",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isRegening ? "not-allowed" : "pointer",
                    alignSelf: "flex-start",
                  }}
                >
                  {isRegening ? "⏳ Regenerando…" : "↻ Rehacer newsletter"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Newsletter preview modal — real email HTML via srcdoc iframe */}
      <Modal
        open={!!newsletterPreviewOpen}
        onClose={() => {
          setNewsletterPreviewOpen(null);
          setTestSentMsg(null);
          setPreviewHtml(null);
        }}
        title={`Newsletter ${newsletterPreviewOpen?.toUpperCase() ?? ""} — Preview del email real`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Load preview button (loads on demand to avoid auth complexity with iframe src) */}
          {!previewHtml && (
            <div style={{ textAlign: "center" }}>
              <button
                disabled={loadingPreview}
                onClick={() => newsletterPreviewOpen && handleLoadPreview(newsletterPreviewOpen)}
                style={{
                  background: loadingPreview ? "#222" : "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: "10px 20px",
                  color: loadingPreview ? "#666" : "#ccc",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: loadingPreview ? "not-allowed" : "pointer",
                }}
              >
                {loadingPreview ? "Cargando (~15s)…" : "👁 Cargar preview del email"}
              </button>
              <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>
                Usa el último newsletter guardado en DB — con posters, ratings y CTAs reales
              </div>
            </div>
          )}

          {/* iframe with real email HTML */}
          {previewHtml && (
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
              style={{
                width: "100%",
                height: 620,
                border: "1px solid #2a2a2a",
                borderRadius: 8,
              }}
              title="Newsletter preview"
            />
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            {testSentMsg ? (
              <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 600 }}>{testSentMsg}</div>
            ) : (
              <button
                disabled={sendingTest}
                onClick={() => newsletterPreviewOpen && handleSendTest(newsletterPreviewOpen)}
                style={{
                  background: sendingTest ? "#333" : "#FA0082",
                  border: "none",
                  borderRadius: 6,
                  padding: "9px 20px",
                  color: sendingTest ? "#888" : "#000",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: sendingTest ? "not-allowed" : "pointer",
                }}
              >
                {sendingTest ? "Enviando (~15s)…" : "📨 Enviar prueba a mi email"}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* ── 4. PEEKRBUZZ ARTICLES (ES only — EN/PT auto-translated) ──── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingLeft: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#d0d0d0" }}>
            PeekrBuzz — Artículos ES
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {translateMsg && (
              <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>{translateMsg}</span>
            )}
            <div style={{ fontSize: 11, color: "#666" }}>
              EN: {enTranslated} · PT: {ptTranslated}
            </div>
            <button
              onClick={handleTranslate}
              disabled={translating || esCount < ARTICLE_ES_TARGET}
              style={{
                background: translating || esCount < ARTICLE_ES_TARGET ? "#2a2a2a" : "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.4)",
                borderRadius: 8,
                padding: "7px 14px",
                color: translating || esCount < ARTICLE_ES_TARGET ? "#555" : "#4ade80",
                fontSize: 12,
                fontWeight: 600,
                cursor: translating || esCount < ARTICLE_ES_TARGET ? "not-allowed" : "pointer",
              }}
              title={esCount < ARTICLE_ES_TARGET ? `Seleccioná ${ARTICLE_ES_TARGET} artículos ES primero` : "Traducir artículos seleccionados a EN y PT"}
            >
              {translating ? "⏳ Traduciendo…" : "🌐 Traducir a EN + PT"}
            </button>
          </div>
        </div>

        {/* ES Articles section */}
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 12, background: "#161616" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#d0d0d0" }}>ES</span>
            <span style={{ fontSize: 12, color: "#f87171", fontWeight: 700, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", padding: "2px 8px", borderRadius: 8 }}>
              {esCount}/{ARTICLE_ES_TARGET} seleccionados
            </span>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <ProgressBar value={esCount} max={ARTICLE_ES_TARGET} color="#f87171" />
            </div>
            <span style={{ fontSize: 11, color: "#555" }}>{esOptions} disponibles</span>
          </div>

          {esOptions < ARTICLE_ES_TARGET * 2 && (
            <div style={{ padding: "8px 16px", background: "rgba(251,191,36,0.08)", borderBottom: "1px solid rgba(251,191,36,0.2)", fontSize: 11, color: "#fbbf24" }}>
              ⚠ Pocas opciones ({esOptions}) — presioná Regenerar para generar más.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: 14 }}>
            {buzzArticles.filter(a => a.language === "es").length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#555", fontSize: 13, padding: 32 }}>
                No hay artículos ES para esta semana — presioná Regenerar.
              </div>
            ) : (
              buzzArticles.filter(a => a.language === "es").map((article) => {
                const isSelected = selectedEsIds.has(article.id);
                const isDisabled = !isSelected && esCount >= ARTICLE_ES_TARGET;
                return (
                  <div
                    key={article.id}
                    onClick={() => !isDisabled && handleArticleToggle(article)}
                    style={{
                      background: "#111",
                      border: `2px solid ${isSelected ? "#FA0082" : "#2a2a2a"}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      opacity: isDisabled ? 0.45 : 1,
                      position: "relative",
                      transition: "border-color 0.15s, opacity 0.15s",
                    }}
                  >
                    {isSelected && (
                      <div style={{ position: "absolute", top: 8, right: 10, color: "#FA0082", fontSize: 16, fontWeight: 900 }}>✓</div>
                    )}
                    {article.image_url && (
                      <img
                        src={article.image_url}
                        alt=""
                        style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, marginBottom: 8 }}
                      />
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                      <ThemeBadge theme={article.editorial_theme} />
                      {article.day_slot && isSelected && (
                        <span style={{ fontSize: 9, color: "#FA0082", background: "rgba(124,58,237,0.15)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                          Día {article.day_slot}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0", lineHeight: 1.35, marginBottom: 5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {article.title}
                    </div>
                    {article.summary && (
                      <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {article.summary}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── 5. CAROUSEL OPTIONS ───────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingLeft: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#d0d0d0" }}>
            Posts Diarios — Carousels
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {actualidadSelected}/7 Actualidad · {historiaSelected}/7 Historia · {recoSelected}/1 Reco
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {THEMES.map((theme) => {
            const themeOptions = carouselOptions.filter(
              (c) => c.theme_type === theme
            );
            const approvedCount = themeOptions.filter(
              (c) => c.status === "approved"
            ).length;

            return (
              <div
                key={theme}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {/* Theme header */}
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #2a2a2a",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "#161616",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{THEME_ICONS[theme]}</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: THEME_COLORS[theme],
                    }}
                  >
                    {THEME_LABELS[theme]}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#888",
                      background: "#222",
                      padding: "2px 8px",
                      borderRadius: 8,
                    }}
                  >
                    {approvedCount}/7 días seleccionados
                  </span>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                    <ProgressBar
                      value={approvedCount}
                      max={7}
                      color={THEME_COLORS[theme]}
                    />
                  </div>
                </div>

                {/* Day rows */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                  }}
                >
                  {DAYS_ES.map((dayLabel, dayIdx) => {
                    const day = dayIdx + 1;
                    const dayOptions = themeOptions
                      .filter((c) => c.day_slot === day)
                      .sort((a, b) => a.option_index - b.option_index);
                    const selectedId = selectedCarouselMap.get(
                      `${day}-${theme}`
                    );

                    return (
                      <div
                        key={day}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 14px",
                          borderBottom: day < 7 ? "1px solid #1f1f1f" : "none",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            fontSize: 11,
                            fontWeight: 700,
                            color: selectedId ? THEME_COLORS[theme] : "#555",
                            paddingTop: 4,
                            flexShrink: 0,
                            textAlign: "center",
                          }}
                        >
                          {dayLabel}
                          {selectedId && (
                            <div
                              style={{
                                fontSize: 9,
                                color: THEME_COLORS[theme],
                                marginTop: 2,
                              }}
                            >
                              ✓
                            </div>
                          )}
                        </div>
                        {dayOptions.length === 0 ? (
                          <div
                            style={{
                              fontSize: 11,
                              color: "#444",
                              padding: "4px 8px",
                            }}
                          >
                            Sin opciones generadas
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flex: 1,
                              flexWrap: "wrap",
                            }}
                          >
                            {dayOptions.map((opt) => (
                              <div
                                key={opt.id}
                                style={{ flex: "1 1 0", minWidth: 180, maxWidth: 280 }}
                              >
                                <CarouselOptionCard
                                  option={opt}
                                  selected={selectedId === opt.id}
                                  onSelect={() => handleCarouselSelect(opt)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Reco Jueves section ─────────────────────────────────────── */}
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden", marginTop: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a2a", display: "flex", alignItems: "center", gap: 12, background: "#161616" }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>Reco del Jueves</span>
            <span style={{ fontSize: 11, color: "#888", background: "#222", padding: "2px 8px", borderRadius: 8 }}>
              {recoSelected}/1 seleccionado
            </span>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <ProgressBar value={recoSelected} max={1} color="#10b981" />
            </div>
            <span style={{ fontSize: 11, color: "#666" }}>Publica jueves 14:00 UTC</span>
          </div>
          <div style={{ padding: "12px 14px" }}>
            {(() => {
              const recoOptions = carouselOptions
                .filter(c => c.theme_type === "reco" && c.day_slot === 4)
                .sort((a, b) => a.option_index - b.option_index);
              const selectedRecoId = selectedCarouselMap.get("4-reco");
              if (recoOptions.length === 0) {
                return <div style={{ fontSize: 12, color: "#555", textAlign: "center", padding: 20 }}>Sin opciones Reco generadas — presioná Regenerar</div>;
              }
              return (
                <div style={{ display: "flex", gap: 12 }}>
                  {recoOptions.map(opt => (
                    <div key={opt.id} style={{ flex: "1 1 0", minWidth: 200 }}>
                      <CarouselOptionCard
                        option={opt}
                        selected={selectedRecoId === opt.id}
                        onSelect={() => handleCarouselSelect(opt)}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── 6. FOOTER — LISTO BUTTON ─────────────────────────────────── */}
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#d0d0d0" }}>
          Checklist de aprobación
        </div>

        {/* Checklist items */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { label: "Artículos ES",   done: esCount >= ARTICLE_ES_TARGET,  value: `${esCount}/${ARTICLE_ES_TARGET}` },
            { label: "Traducción EN",  done: enTranslated > 0,              value: enTranslated > 0 ? "listo" : "falta" },
            { label: "Traducción PT",  done: ptTranslated > 0,              value: ptTranslated > 0 ? "listo" : "falta" },
            { label: "Actualidad",     done: actualidadSelected >= 7,       value: `${actualidadSelected}/7` },
            { label: "Historia",       done: historiaSelected >= 7,         value: `${historiaSelected}/7` },
            { label: "Reco Jueves",    done: recoSelected >= 1,             value: recoSelected >= 1 ? "listo" : "falta" },
            {
              label: "Newsletter ES",
              done: hasNewsletterEs,
              value: hasNewsletterEs ? "listo" : "falta",
            },
            {
              label: "Newsletter PT",
              done: hasNewsletterPt,
              value: hasNewsletterPt ? "listo" : "falta",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#111",
                borderRadius: 8,
                padding: "8px 12px",
                border: `1px solid ${item.done ? "rgba(74,222,128,0.25)" : "#2a2a2a"}`,
              }}
            >
              <span style={{ fontSize: 14 }}>{item.done ? "✅" : "⏳"}</span>
              <span style={{ fontSize: 12, color: item.done ? "#4ade80" : "#888", fontWeight: 600 }}>
                {item.label}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: item.done ? "#4ade80" : "#666",
                  fontWeight: 700,
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Success state */}
        {approved || plan?.status === "approved" ? (
          <div
            style={{
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.35)",
              borderRadius: 10,
              padding: "16px 20px",
              color: "#4ade80",
              fontSize: 15,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            ✅ Semana aprobada — el contenido se publicará según el cronograma
          </div>
        ) : (
          <button
            onClick={handleApproveWeek}
            disabled={!allComplete || saving}
            style={{
              background: allComplete && !saving
                ? "linear-gradient(135deg, #FA0082, #e6006e)"
                : "#2a2a2a",
              border: allComplete && !saving
                ? "1px solid #FA0082"
                : "1px solid #333",
              borderRadius: 10,
              padding: "0 24px",
              height: 54,
              color: allComplete && !saving ? "#fff" : "#555",
              fontSize: 15,
              fontWeight: 800,
              cursor: allComplete && !saving ? "pointer" : "not-allowed",
              width: "100%",
              letterSpacing: "0.02em",
              transition: "all 0.2s",
            }}
          >
            {saving
              ? "Guardando…"
              : !allComplete
              ? "🔒 LISTO — PUBLICAR ESTA SEMANA (completa todos los items)"
              : "🚀 LISTO — PUBLICAR ESTA SEMANA"}
          </button>
        )}
      </div>
    </div>
  );
}
