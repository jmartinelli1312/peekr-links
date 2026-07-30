"use client";

import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types, helpers and presentational components for the creator dashboard.
// Date logic mirrors admin/PulsoTab (ART-calendar based) so the country
// dashboard lines up with the same day boundaries the admin Pulse uses.
// ─────────────────────────────────────────────────────────────────────────────

export type Lang = "es" | "en" | "pt";
export type Preset = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

export const BRAND = "#FA0082";

// ── Date helpers ──────────────────────────────────────────────────────────────
export function toDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayStr() {
  return toDateStr(new Date());
}

export function artDateMinusDays(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T03:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return toDateStr(d);
}

export function presetRange(p: Preset): { from: string; to: string } {
  const today = todayStr();
  if (p === "today") return { from: today, to: today };
  if (p === "yesterday") {
    const y = artDateMinusDays(today, 1);
    return { from: y, to: y };
  }
  if (p === "7d") return { from: artDateMinusDays(today, 6), to: today };
  if (p === "30d") return { from: artDateMinusDays(today, 29), to: today };
  return { from: artDateMinusDays(today, 89), to: today };
}

export function artRangeToUtcIso(range: { from: string; to: string }) {
  const fromTs = `${range.from}T03:00:00.000Z`;
  const endAnchor = new Date(`${range.to}T03:00:00.000Z`);
  endAnchor.setUTCDate(endAnchor.getUTCDate() + 1);
  return { fromTs, toTsExclusive: endAnchor.toISOString() };
}

// ── Formatters ──────────────────────────────────────────────────────────────
export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("es-AR");
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n}%`;
}

export function deltaPct(curr: number, prev: number): { pct: number; sign: "up" | "down" | "flat" } {
  if (prev === 0) return { pct: 0, sign: curr > 0 ? "up" : "flat" };
  const pct = ((curr - prev) / prev) * 100;
  return {
    pct: Math.round(Math.abs(pct)),
    sign: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat",
  };
}

// ── Country names ─────────────────────────────────────────────────────────────
export const COUNTRY_NAMES: Record<string, string> = {
  AE: "Emiratos Árabes", AR: "Argentina", AU: "Australia", BE: "Bélgica",
  BO: "Bolivia", BR: "Brasil", CA: "Canadá", CH: "Suiza", CL: "Chile",
  CN: "China", CO: "Colombia", CR: "Costa Rica", CU: "Cuba", DE: "Alemania",
  DK: "Dinamarca", DO: "Rep. Dominicana", EC: "Ecuador", EG: "Egipto",
  ES: "España", FR: "Francia", GB: "Reino Unido", GT: "Guatemala",
  HN: "Honduras", IL: "Israel", IN: "India", IT: "Italia", JP: "Japón",
  KR: "Corea del Sur", MX: "México", NG: "Nigeria", NI: "Nicaragua",
  NL: "Países Bajos", NO: "Noruega", PA: "Panamá", PE: "Perú",
  PL: "Polonia", PR: "Puerto Rico", PT: "Portugal", PY: "Paraguay",
  RU: "Rusia", SA: "Arabia Saudita", SE: "Suecia", SV: "El Salvador",
  TR: "Turquía", US: "Estados Unidos", UY: "Uruguay", VE: "Venezuela",
  ZA: "Sudáfrica",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

// ── Title / poster helpers ────────────────────────────────────────────────────
export type TitleRow = {
  tmdb_id: number;
  title_es: string | null;
  title_en: string | null;
  title_pt: string | null;
  poster_path: string | null;
  vote_average: number | null;
  views_count?: number;
  peekr_avg?: number;
  ratings_count?: number;
  saves_count?: number;
};

export function pickTitle(t: TitleRow, lang: Lang): string {
  const byLang =
    lang === "en" ? t.title_en : lang === "pt" ? t.title_pt : t.title_es;
  return byLang || t.title_es || t.title_en || t.title_pt || `#${t.tmdb_id}`;
}

export function posterUrl(path: string | null, size: "w185" | "w342" = "w185"): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// ── Presentational components ──────────────────────────────────────────────────
export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "20px 22px",
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>{title}</h2>
        {subtitle && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "14px 16px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ?? "rgba(255,255,255,0.96)", lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function StatGrid({ children, min = 150 }: { children: ReactNode; min?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

/** Horizontal bar breakdown from a {label -> count} map. */
export function BarList({ data, color = BRAND, emptyLabel = "—" }: { data: Record<string, number>; color?: string; emptyLabel?: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 0) || 1;
  if (entries.length === 0) {
    return <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{emptyLabel}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map(([label, value]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 110, fontSize: 13, color: "rgba(255,255,255,0.75)", textTransform: "capitalize" }}>
            {label}
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 20, position: "relative" }}>
            <div
              style={{
                width: `${(value / max) * 100}%`,
                background: color,
                height: "100%",
                borderRadius: 6,
                minWidth: 2,
              }}
            />
          </div>
          <div style={{ width: 56, textAlign: "right", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
            {fmtInt(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Minimal SVG line chart for a single series (e.g. cumulative growth). */
export function LineChart({ values, labels, color = BRAND, height = 160 }: { values: number[]; labels: string[]; color?: string; height?: number }) {
  const w = 600;
  const h = height;
  const pad = 8;
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r={3.5} fill={color} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}
