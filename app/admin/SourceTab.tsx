"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

// ── Argentina-calendar helpers (match the rest of the dashboard) ──────────────
// 00:00 ART = 03:00 UTC of the same calendar date (Argentina is UTC-3, no DST).
function artMidnightIso(offsetDays: number): string {
  const todayArt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "YYYY-MM-DD"
  const d = new Date(`${todayArt}T03:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
}

// custom date string (YYYY-MM-DD) → 00:00 ART as a UTC ISO instant
function dateToArtIso(dateStr: string, plusDays = 0): string {
  const d = new Date(`${dateStr}T03:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d.toISOString();
}

type RangeKey = "hoy" | "ayer" | "7d" | "30d" | "custom";

type SourceData = {
  total: number;
  attributed: number;
  unattributed: number;
  by_platform: Array<{ platform: string; n: number }>;
  by_source: Array<{ source: string; n: number }>;
  by_source_platform: Array<{ source: string; platform: string; n: number }>;
};

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "custom", label: "Custom" },
];

const PLATFORM_LABEL: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  unknown: "Sin plataforma",
};

function pct(n: number, total: number): string {
  if (!total) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

export default function SourceTab({ supabase }: { supabase: SupabaseClient }) {
  const [range, setRange] = useState<RangeKey>("7d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [data, setData] = useState<SourceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const bounds = useMemo<{ from: string; to: string } | null>(() => {
    switch (range) {
      case "hoy":
        return { from: artMidnightIso(0), to: artMidnightIso(1) };
      case "ayer":
        return { from: artMidnightIso(-1), to: artMidnightIso(0) };
      case "7d":
        return { from: artMidnightIso(-6), to: artMidnightIso(1) };
      case "30d":
        return { from: artMidnightIso(-29), to: artMidnightIso(1) };
      case "custom":
        if (!customFrom || !customTo) return null;
        return { from: dateToArtIso(customFrom), to: dateToArtIso(customTo, 1) };
    }
  }, [range, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!bounds) return;
    setLoading(true);
    setError("");
    try {
      const { data: res, error: err } = await supabase.rpc(
        "admin_kpi_acquisition_sources",
        { p_from: bounds.from, p_to_exclusive: bounds.to }
      );
      if (err) throw err;
      setData(res as SourceData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando fuentes");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, bounds]);

  useEffect(() => {
    load();
  }, [load]);

  const maxSource = useMemo(
    () => Math.max(1, ...(data?.by_source ?? []).map((s) => s.n)),
    [data]
  );

  // Build the source × platform matrix as rows (source) × cols (platforms present)
  const matrix = useMemo(() => {
    if (!data) return { platforms: [], rows: [] as Array<{ source: string; cells: Record<string, number>; total: number }> };
    const platforms = (data.by_platform ?? []).map((p) => p.platform);
    const bySource = new Map<string, { source: string; cells: Record<string, number>; total: number }>();
    for (const r of data.by_source_platform ?? []) {
      const row = bySource.get(r.source) ?? { source: r.source, cells: {}, total: 0 };
      row.cells[r.platform] = (row.cells[r.platform] ?? 0) + r.n;
      row.total += r.n;
      bySource.set(r.source, row);
    }
    const rows = [...bySource.values()].sort((a, b) => b.total - a.total);
    return { platforms, rows };
  }, [data]);

  const total = data?.total ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em" }}>
          🎯 Fuentes de adquisición
        </h2>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          De dónde vienen los usuarios nuevos (Meta, web, creators, canales, orgánico) por plataforma.
          La atribución se puebla desde el build que captura el token; usuarios previos quedan como{" "}
          <strong>(sin atribuir)</strong>. La plataforma (iOS/Android) está disponible para todos.
        </p>
      </div>

      {/* Range selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              background: range === r.key ? "rgba(250,0,130,0.12)" : "transparent",
              border: `1px solid ${range === r.key ? "#FA0082" : "rgba(255,255,255,0.12)"}`,
              color: range === r.key ? "#FA0082" : "rgba(255,255,255,0.7)",
            }}
          >
            {r.label}
          </button>
        ))}
        {range === "custom" && (
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={inputStyle}
            />
            <span style={{ color: "rgba(255,255,255,0.5)" }}>→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={inputStyle}
            />
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "rgba(255,90,90,0.08)",
            border: "1px solid rgba(255,90,90,0.25)",
            color: "#ffb3b3",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={cardStyle}>Cargando…</div>
      ) : !data ? (
        <div style={cardStyle}>
          {range === "custom" ? "Elegí un rango de fechas." : "Sin datos."}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <SummaryCard label="Usuarios nuevos" value={total} />
            <SummaryCard label="Atribuidos" value={data.attributed} sub={pct(data.attributed, total)} />
            <SummaryCard label="Sin atribuir" value={data.unattributed} sub={pct(data.unattributed, total)} />
          </div>

          {/* Platform breakdown */}
          <div style={cardStyle}>
            <h3 style={h3Style}>Por plataforma</h3>
            {(data.by_platform ?? []).map((p) => (
              <div key={p.platform} style={rowStyle}>
                <span style={{ fontWeight: 700 }}>{PLATFORM_LABEL[p.platform] ?? p.platform}</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>
                  {p.n.toLocaleString()} <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>· {pct(p.n, total)}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Source breakdown with bars */}
          <div style={cardStyle}>
            <h3 style={h3Style}>Por fuente</h3>
            {(data.by_source ?? []).map((s) => (
              <div key={s.source} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: s.source === "(sin atribuir)" ? "rgba(255,255,255,0.5)" : "white" }}>
                    {s.source}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>
                    {s.n.toLocaleString()} <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>· {pct(s.n, total)}</span>
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.07)" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(s.n / maxSource) * 100}%`,
                      borderRadius: 999,
                      background: s.source === "(sin atribuir)" ? "rgba(255,255,255,0.25)" : "#FA0082",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Source × platform matrix */}
          <div style={cardStyle}>
            <h3 style={h3Style}>Fuente × plataforma</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fuente</th>
                    {matrix.platforms.map((p) => (
                      <th key={p} style={{ ...thStyle, textAlign: "right" }}>
                        {PLATFORM_LABEL[p] ?? p}
                      </th>
                    ))}
                    <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row) => (
                    <tr key={row.source}>
                      <td style={{ ...tdStyle, color: row.source === "(sin atribuir)" ? "rgba(255,255,255,0.5)" : "white", fontWeight: 700 }}>
                        {row.source}
                      </td>
                      {matrix.platforms.map((p) => (
                        <td key={p} style={{ ...tdStyle, textAlign: "right", color: "rgba(255,255,255,0.75)" }}>
                          {(row.cells[p] ?? 0).toLocaleString()}
                        </td>
                      ))}
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{row.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 30, lineHeight: 1, fontWeight: 900 }}>{value.toLocaleString()}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{sub}</div>}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 18,
};

const h3Style: React.CSSProperties = { margin: "0 0 10px 0", fontSize: 16, fontWeight: 900 };

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.55)",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  whiteSpace: "nowrap",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  padding: "7px 10px",
  color: "white",
  fontSize: 13,
  colorScheme: "dark",
};
