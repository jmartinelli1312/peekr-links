"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  supabase: SupabaseClient;
}

type UserRow = {
  id: string;
  country_code: string | null;
  created_at: string;
};

type TokenRow = {
  user_id: string;
  platform: string | null;
};

type SliceData = { label: string; count: number; pct: number; color: string };

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = [
  "#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#6366f1", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  "#8b5cf6", "#06b6d4",
];

const COUNTRY_NAMES: Record<string, string> = {
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

const PLATFORM_LABEL: Record<string, string> = {
  ios: "iOS",
  android: "Android",
};

type Preset = "today" | "yesterday" | "7d" | "30d" | "custom";

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function todayStr() {
  return toDateStr(new Date());
}

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  if (p === "today") return { from: todayStr(), to: todayStr() };
  if (p === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: toDateStr(y), to: toDateStr(y) };
  }
  if (p === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: toDateStr(d), to: todayStr() };
  }
  // 30d
  const d = new Date(now);
  d.setDate(d.getDate() - 29);
  return { from: toDateStr(d), to: todayStr() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure SVG Pie / Donut chart
// ─────────────────────────────────────────────────────────────────────────────
function MiniPie({ slices, total }: { slices: SliceData[]; total: number }) {
  const cx = 72, cy = 72, r = 64, innerR = 38;

  const paths: { d: string; color: string; label: string }[] = [];
  let startAngle = -90;

  for (const s of slices) {
    const sweep = (s.count / total) * 360;
    const endAngle = startAngle + sweep;
    paths.push({ d: donutArc(cx, cy, r, innerR, startAngle, endAngle), color: s.color, label: s.label });
    startAngle = endAngle;
  }

  return (
    <svg width={144} height={144} viewBox="0 0 144 144">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} stroke="#0f1014" strokeWidth={1.5}>
          <title>{p.label}</title>
        </path>
      ))}
      {/* center hole label */}
      <text x={cx} y={cy + 5} textAnchor="middle" fill="#ffffff" fontSize={13} fontWeight={700}>
        {total}
      </text>
      <text x={cx} y={cy + 20} textAnchor="middle" fill="#ffffff88" fontSize={9}>
        total
      </text>
    </svg>
  );
}

function donutArc(cx: number, cy: number, r: number, innerR: number, startDeg: number, endDeg: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const xi1 = cx + innerR * Math.cos(toRad(startDeg));
  const yi1 = cy + innerR * Math.sin(toRad(startDeg));
  const xi2 = cx + innerR * Math.cos(toRad(endDeg));
  const yi2 = cy + innerR * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerR} ${innerR} 0 ${large} 0 ${xi1} ${yi1} Z`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build slices from a count map
// ─────────────────────────────────────────────────────────────────────────────
function buildSlices(counts: Record<string, number>, labelFn: (k: string) => string, topN = 10): SliceData[] {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN);
  const othersSum = sorted.slice(topN).reduce((a, [, v]) => a + v, 0);

  const result: SliceData[] = top.map(([k, v], i) => ({
    label: labelFn(k),
    count: v,
    pct: (v / total) * 100,
    color: COLORS[i % COLORS.length],
  }));

  if (othersSum > 0) {
    result.push({
      label: "Otros",
      count: othersSum,
      pct: (othersSum / total) * 100,
      color: "#4b5563",
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// ChartPanel: pie + legend + table
// ─────────────────────────────────────────────────────────────────────────────
function ChartPanel({ title, slices }: { title: string; slices: SliceData[] }) {
  const total = slices.reduce((a, b) => a + b.count, 0);
  if (total === 0) {
    return (
      <div style={{ padding: "16px 0", color: "#ffffff55", fontSize: 13 }}>
        Sin datos para este período.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "#ffffff77", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
        {title}
      </div>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <MiniPie slices={slices} total={total} />
        <div style={{ flex: 1, minWidth: 160 }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, color: "#ffffffcc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: "#ffffff88", flexShrink: 0 }}>
                {s.count}
              </div>
              <div style={{
                fontSize: 11,
                color: "#ffffff55",
                flexShrink: 0,
                minWidth: 36,
                textAlign: "right",
              }}>
                {s.pct.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RankedTable: sorted rows with inline % bar
// ─────────────────────────────────────────────────────────────────────────────
function RankedTable({ rows, topN = 15 }: { rows: SliceData[]; topN?: number }) {
  const max = rows[0]?.count ?? 1;
  return (
    <div>
      {rows.slice(0, topN).map((r, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: "#ffffffcc" }}>
              <span style={{ color: r.color, marginRight: 6 }}>●</span>
              {r.label}
            </span>
            <span style={{ fontSize: 12, color: "#ffffff88" }}>
              {r.count} <span style={{ color: "#ffffff44" }}>({r.pct.toFixed(1)}%)</span>
            </span>
          </div>
          <div style={{ height: 3, background: "#ffffff11", borderRadius: 2 }}>
            <div style={{
              height: 3,
              width: `${(r.count / max) * 100}%`,
              background: r.color,
              borderRadius: 2,
              transition: "width .4s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function UserGeoTab({ supabase }: Props) {
  // Filter state
  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState(toDateStr(new Date()));
  const [customTo, setCustomTo] = useState(toDateStr(new Date()));

  // Data state
  const [newUsers, setNewUsers] = useState<UserRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed date range
  const range = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromTs = range.from + "T00:00:00.000Z";
      const toTs = range.to + "T23:59:59.999Z";

      // New users in date range
      const { data: newData, error: e1 } = await supabase
        .from("profiles")
        .select("id, country_code, created_at")
        .gte("created_at", fromTs)
        .lte("created_at", toTs)
        .order("created_at", { ascending: false });
      if (e1) throw e1;

      // All users (global)
      const { data: allData, error: e2 } = await supabase
        .from("profiles")
        .select("id, country_code, created_at");
      if (e2) throw e2;

      // Push tokens for all users (to get platform)
      const { data: tokenData, error: e3 } = await supabase
        .from("push_tokens")
        .select("user_id, platform");
      if (e3) throw e3;

      setNewUsers((newData ?? []) as UserRow[]);
      setAllUsers((allData ?? []) as UserRow[]);
      setTokens((tokenData ?? []) as TokenRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [supabase, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Build derived stats ────────────────────────────────────────────────────

  // Map user_id → platform (first token found)
  const platformMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tokens) {
      if (t.user_id && t.platform && !map.has(t.user_id)) {
        map.set(t.user_id, t.platform);
      }
    }
    return map;
  }, [tokens]);

  function countBy(rows: UserRow[], key: "country_code" | "platform") {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      let val: string;
      if (key === "country_code") {
        val = r.country_code?.toUpperCase() ?? "Desconocido";
      } else {
        val = platformMap.get(r.id) ?? "unknown";
      }
      counts[val] = (counts[val] ?? 0) + 1;
    }
    return counts;
  }

  const newCountrySlices = useMemo(() =>
    buildSlices(countBy(newUsers, "country_code"), k => COUNTRY_NAMES[k] ?? k, 10),
    [newUsers, platformMap] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const newPlatformSlices = useMemo(() =>
    buildSlices(countBy(newUsers, "platform"), k => PLATFORM_LABEL[k] ?? k, 5),
    [newUsers, platformMap] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const allCountrySlices = useMemo(() =>
    buildSlices(countBy(allUsers, "country_code"), k => COUNTRY_NAMES[k] ?? k, 12),
    [allUsers, platformMap] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const allPlatformSlices = useMemo(() =>
    buildSlices(countBy(allUsers, "platform"), k => PLATFORM_LABEL[k] ?? k, 5),
    [allUsers, platformMap] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Render helpers ──────────────────────────────────────────────────────────

  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: "Hoy" },
    { key: "yesterday", label: "Ayer" },
    { key: "7d", label: "7 días" },
    { key: "30d", label: "30 días" },
    { key: "custom", label: "Período" },
  ];

  const rangeLabel = preset === "custom"
    ? `${range.from} → ${range.to}`
    : preset === "today" ? "Hoy"
    : preset === "yesterday" ? "Ayer"
    : preset === "7d" ? "Últimos 7 días"
    : "Últimos 30 días";

  return (
    <div style={{ paddingBottom: 60 }}>

      {/* ── Date filter bar ──────────────────────────────────────────────── */}
      <section className="section" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                background: preset === p.key ? "#a855f7" : "#1e1a2e",
                color: preset === p.key ? "#fff" : "#ffffff88",
                transition: "all .15s",
              }}
            >
              {p.label}
            </button>
          ))}

          {preset === "custom" && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                style={dateInputStyle}
              />
              <span style={{ color: "#ffffff44", fontSize: 12 }}>→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={dateInputStyle}
              />
              <button
                onClick={fetchData}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  background: "#7c3aed",
                  color: "#fff",
                }}
              >
                Aplicar
              </button>
            </>
          )}

          {loading && (
            <span style={{ fontSize: 12, color: "#ffffff44", marginLeft: 8 }}>Cargando…</span>
          )}

          {error && (
            <span style={{ fontSize: 12, color: "#ef4444", marginLeft: 8 }}>{error}</span>
          )}
        </div>
      </section>

      {/* ── NEW USERS section ─────────────────────────────────────────────── */}
      <section className="section" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>Nuevos usuarios</h2>
          <span style={{ fontSize: 13, color: "#ffffff55" }}>{rangeLabel}</span>
          <span style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#a855f7",
            marginLeft: "auto",
          }}>{newUsers.length}</span>
        </div>
        <p className="section-note" style={{ marginBottom: 20 }}>
          Usuarios registrados en el período seleccionado, por país y plataforma.
        </p>

        {newUsers.length === 0 && !loading ? (
          <div style={{ color: "#ffffff44", fontSize: 13, padding: "20px 0" }}>
            Sin nuevos usuarios en este período.
          </div>
        ) : (
          <div className="three-col" style={{ alignItems: "flex-start" }}>
            {/* Country pie */}
            <div className="card">
              <ChartPanel title="Por país" slices={newCountrySlices} />
            </div>

            {/* Platform pie */}
            <div className="card">
              <ChartPanel title="Por plataforma" slices={newPlatformSlices} />
            </div>

            {/* Ranked table */}
            <div className="card">
              <div style={{ fontSize: 12, color: "#ffffff77", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                Ranking países
              </div>
              <RankedTable rows={newCountrySlices} />
            </div>
          </div>
        )}
      </section>

      {/* ── GLOBAL section ───────────────────────────────────────────────── */}
      <section className="section" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>Global — todos los usuarios</h2>
          <span style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#a855f7",
            marginLeft: "auto",
          }}>{allUsers.length}</span>
        </div>
        <p className="section-note" style={{ marginBottom: 20 }}>
          Distribución geográfica y de plataforma del 100% de la base de usuarios.
        </p>

        <div className="three-col" style={{ alignItems: "flex-start" }}>
          {/* Country pie */}
          <div className="card">
            <ChartPanel title="Por país" slices={allCountrySlices} />
          </div>

          {/* Platform pie */}
          <div className="card">
            <ChartPanel title="Por plataforma" slices={allPlatformSlices} />
          </div>

          {/* Ranked table */}
          <div className="card">
            <div style={{ fontSize: 12, color: "#ffffff77", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
              Ranking países
            </div>
            <RankedTable rows={allCountrySlices} topN={20} />
          </div>
        </div>
      </section>

    </div>
  );
}

const dateInputStyle: React.CSSProperties = {
  background: "#1e1a2e",
  border: "1px solid #ffffff22",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  padding: "4px 10px",
  colorScheme: "dark",
};
