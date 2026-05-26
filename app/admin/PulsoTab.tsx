"use client";

// PulsoTab — consolidated admin dashboard.
// Replaces the older Metrics + Analytics tabs. Pulls 4 RPCs:
//   - admin_kpi_acquisition(from, to)
//   - admin_kpi_retention(anchor)
//   - admin_kpi_behavior(from, to)
//   - admin_kpi_top_creators(from, to, metric, limit)
// One date filter at the top drives the three range-based RPCs.

import { useCallback, useEffect, useMemo, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  supabase: SupabaseClient;
}

type Preset = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

type Acquisition = {
  new_signups: number;
  new_signups_prev: number;
  onboarding_completed: number;
  onboarding_rate: number;
  by_platform: Record<string, number>;
  by_country: { top: { country_code: string; n: number }[]; other: number };
  by_provider: Record<string, number>;
  growth_chart: { day: string; signups: number; cumulative: number }[];
};

type Retention = {
  dau: number;
  wau: number;
  mau: number;
  dau_returning: number;
  wau_returning: number;
  mau_returning: number;
  stickiness: number;            // standard DAU / MAU
  stickiness_returning: number;  // returning DAU / returning MAU
  churn_risk: number;
  resurrected: number;
  first_time_active: number;
  by_app_version: Record<string, number>;
};

type Behavior = {
  active_users: number;
  ratings: { total: number; prev: number; per_active_avg: number };
  comments: { total: number; prev: number; per_active_avg: number };
  watchlist: { total: number; prev: number; per_active_avg: number };
  peeklists: {
    created: number;
    prev: number;
    items_added: number;
    avg_items_per_peeklist: number;
  };
  likes: {
    comment_likes_given: number;
    comment_likes_received: number;
    title_likes: number;
  };
  follows: { created: number; mutual: number; mutual_pct: number };
  north_star_war_returning: number;
  shares_total: number;
};

type Creator = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  account_type: string | null;
  creator_status: string | null;
  score: number;
};

type TopMetric =
  | "ratings"
  | "comments"
  | "peeklists"
  | "follower_growth"
  | "likes_received";

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers (ART-calendar based — same as UserGeoTab)
// ─────────────────────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function todayStr() {
  return toDateStr(new Date());
}

function artDateMinusDays(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T03:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return toDateStr(d);
}

function presetRange(p: Preset): { from: string; to: string } {
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

function artRangeToUtcIso(range: { from: string; to: string }) {
  const fromTs = `${range.from}T03:00:00.000Z`;
  const endAnchor = new Date(`${range.to}T03:00:00.000Z`);
  endAnchor.setUTCDate(endAnchor.getUTCDate() + 1);
  return { fromTs, toTsExclusive: endAnchor.toISOString() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Traffic light — green / yellow / red thresholds
// ─────────────────────────────────────────────────────────────────────────────
type Light = "green" | "yellow" | "red" | "neutral";

function lightFor(
  value: number,
  thresholds: { red: number; yellow: number }
): Light {
  if (value < thresholds.red) return "red";
  if (value < thresholds.yellow) return "yellow";
  return "green";
}

const LIGHT_COLOR: Record<Light, string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  neutral: "#6b7280",
};

const LIGHT_BG: Record<Light, string> = {
  green: "rgba(16,185,129,.12)",
  yellow: "rgba(245,158,11,.14)",
  red: "rgba(239,68,68,.14)",
  neutral: "rgba(107,114,128,.12)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────
function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("es-AR");
}

function deltaPct(curr: number, prev: number): { pct: number; sign: "up" | "down" | "flat" } {
  if (prev === 0) return { pct: 0, sign: curr > 0 ? "up" : "flat" };
  const pct = ((curr - prev) / prev) * 100;
  return {
    pct: Math.abs(pct),
    sign: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat",
  };
}

// Country name lookup (subset — reuse from UserGeoTab via inline copy)
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

function countryName(code: string): string {
  if (code === "Desconocido") return code;
  return COUNTRY_NAMES[code] ?? code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function PulsoTab({ supabase }: Props) {
  // Filter state
  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  // When true, retention + behavior + top_creators RPCs filter to users
  // who have done at least one meaningful action (rating / comment /
  // watchlist / peeklist / follow / like). This catches both completed-
  // onboarding users AND the ~500 users who completed actions but bounced
  // before tapping "Continuar" on the rate screen (the flag stayed false).
  // Acquisition counters are not affected — that section deliberately
  // shows the full funnel including bouncers.
  const [onlyOnboarded, setOnlyOnboarded] = useState(false);

  const range = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  // Data state
  const [acquisition, setAcquisition] = useState<Acquisition | null>(null);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [behavior, setBehavior] = useState<Behavior | null>(null);
  const [topMetric, setTopMetric] = useState<TopMetric>("ratings");
  const [topCreators, setTopCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { fromTs, toTsExclusive } = artRangeToUtcIso(range);

      const [acqRes, retRes, behRes] = await Promise.all([
        supabase.rpc("admin_kpi_acquisition", {
          p_from: fromTs,
          p_to_exclusive: toTsExclusive,
        }),
        supabase.rpc("admin_kpi_retention", {
          p_only_onboarded: onlyOnboarded,
        }),
        supabase.rpc("admin_kpi_behavior", {
          p_from: fromTs,
          p_to_exclusive: toTsExclusive,
          p_only_onboarded: onlyOnboarded,
        }),
      ]);

      if (acqRes.error) throw acqRes.error;
      if (retRes.error) throw retRes.error;
      if (behRes.error) throw behRes.error;

      setAcquisition(acqRes.data as Acquisition);
      setRetention(retRes.data as Retention);
      setBehavior(behRes.data as Behavior);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase, range, onlyOnboarded]);

  const fetchTopCreators = useCallback(async () => {
    try {
      const { fromTs, toTsExclusive } = artRangeToUtcIso(range);
      const { data, error } = await supabase.rpc("admin_kpi_top_creators", {
        p_from: fromTs,
        p_to_exclusive: toTsExclusive,
        p_metric: topMetric,
        p_limit: 10,
        p_only_onboarded: onlyOnboarded,
      });
      if (error) throw error;
      setTopCreators((data as Creator[]) ?? []);
    } catch (e) {
      console.warn("[PulsoTab] top creators fetch error", e);
      setTopCreators([]);
    }
  }, [supabase, range, topMetric, onlyOnboarded]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    void fetchTopCreators();
  }, [fetchTopCreators]);

  // ── Derived: alerts based on traffic lights ───────────────────────────────
  const alerts = useMemo<string[]>(() => {
    const list: string[] = [];
    if (acquisition) {
      const obLight = lightFor(acquisition.onboarding_rate, { red: 40, yellow: 60 });
      if (obLight === "red")
        list.push(
          `Onboarding completion en ${acquisition.onboarding_rate}% — abajo del piso (40%). Es la fuga más grande.`
        );
    }
    if (behavior) {
      const warLight = lightFor(behavior.north_star_war_returning, {
        red: 50,
        yellow: 150,
      });
      if (warLight === "red")
        list.push(
          `North Star (WAR returning) = ${behavior.north_star_war_returning}. Pocos users establecidos están rateando.`
        );
    }
    if (retention) {
      const stkLight = lightFor(retention.stickiness, { red: 5, yellow: 12 });
      if (stkLight === "red")
        list.push(
          `Stickiness (DAU/MAU) = ${retention.stickiness}%. La gente abre el app, pero no vuelve.`
        );
    }
    return list;
  }, [acquisition, retention, behavior]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ═════ HEADER + FILTER ═════ */}
      <div style={headerWrap}>
        <div>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 22 }}>📈 Pulso</h2>
          <p style={{ color: "#888", margin: "4px 0 0", fontSize: 13 }}>
            Vista única con North Star, semáforos y alertas. Filtro afecta
            Adquisición + Comportamiento + Top creators. Retención usa la
            última semana / mes calendario.
          </p>
        </div>
        <button onClick={fetchAll} disabled={loading} style={btnPrimary}>
          {loading ? "Cargando..." : "↻ Refrescar"}
        </button>
      </div>

      <DateFilter
        preset={preset}
        setPreset={setPreset}
        customFrom={customFrom}
        customTo={customTo}
        setCustomFrom={setCustomFrom}
        setCustomTo={setCustomTo}
      />

      {/* Engaged-users toggle. The original "onboarded" filter relied on
          a flag that's set only after the user taps "Continuar" on the
          rate screen — but ~500 users complete actions and bounce before
          that final tap. This toggle uses a cleaner proxy: "user has
          done ≥1 meaningful action ever". */}
      <div style={onboardedToggleBar}>
        <div>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
            Filtrar a usuarios con ≥1 acción real
          </div>
          <div style={{ color: "#fff8", fontSize: 11, marginTop: 2 }}>
            Excluye signups que se fueron sin hacer nada. Solo afecta
            Retención, Comportamiento y Top creators — Adquisición siempre
            cuenta el funnel completo.
          </div>
        </div>
        <button
          onClick={() => setOnlyOnboarded((v) => !v)}
          style={onlyOnboarded ? toggleOn : toggleOff}
          aria-pressed={onlyOnboarded}
        >
          <div
            style={{
              ...toggleKnob,
              transform: onlyOnboarded ? "translateX(20px)" : "translateX(0)",
            }}
          />
        </button>
      </div>

      {err && (
        <div style={errBox}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {/* ═════ NORTH STAR ═════ */}
      <NorthStarCard behavior={behavior} />

      {/* ═════ ALERTS ═════ */}
      {alerts.length > 0 && (
        <div style={alertBox}>
          <div style={{ fontWeight: 700, color: "#fca5a5", marginBottom: 8 }}>
            ⚠️ {alerts.length} alerta{alerts.length === 1 ? "" : "s"} activa
            {alerts.length === 1 ? "" : "s"}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#fecaca" }}>
            {alerts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ═════ ADQUISICIÓN ═════ */}
      <AcquisitionSection data={acquisition} />

      {/* ═════ RETENCIÓN ═════ */}
      <RetentionSection data={retention} />

      {/* ═════ COMPORTAMIENTO ═════ */}
      <BehaviorSection data={behavior} />

      {/* ═════ TOP CREATORS ═════ */}
      <TopCreatorsSection
        creators={topCreators}
        metric={topMetric}
        setMetric={setTopMetric}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DATE FILTER
// ═════════════════════════════════════════════════════════════════════════════
function DateFilter({
  preset, setPreset, customFrom, customTo, setCustomFrom, setCustomTo,
}: {
  preset: Preset;
  setPreset: (p: Preset) => void;
  customFrom: string; customTo: string;
  setCustomFrom: (s: string) => void;
  setCustomTo: (s: string) => void;
}) {
  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: "Hoy" },
    { key: "yesterday", label: "Ayer" },
    { key: "7d", label: "Últimos 7d" },
    { key: "30d", label: "Últimos 30d" },
    { key: "90d", label: "Últimos 90d" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div style={filterBar}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            style={preset === p.key ? presetActive : presetBtn}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            style={dateInput}
          />
          <span style={{ color: "#888" }}>→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            style={dateInput}
          />
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// NORTH STAR
// ═════════════════════════════════════════════════════════════════════════════
function NorthStarCard({ behavior }: { behavior: Behavior | null }) {
  const value = behavior?.north_star_war_returning ?? 0;
  const light = lightFor(value, { red: 50, yellow: 150 });

  return (
    <div
      style={{
        ...sectionCard,
        padding: 20,
        background: LIGHT_BG[light],
        borderColor: LIGHT_COLOR[light] + "55",
      }}
    >
      <div style={{ fontSize: 12, color: "#fff8", letterSpacing: 1 }}>
        🌟 NORTH STAR — Weekly Active Raters (returning)
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 6 }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: LIGHT_COLOR[light],
            lineHeight: 1,
          }}
        >
          {formatNumber(value)}
        </div>
        <div style={{ fontSize: 14, color: "#ffffffaa", marginBottom: 6 }}>
          users con cuenta ≥7d que ratearon al menos 1 título esta semana
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 12, color: "#fff9" }}>
        <span>🔴 &lt; 50</span>
        <span>🟡 50 – 150</span>
        <span>🟢 ≥ 150</span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ADQUISICIÓN
// ═════════════════════════════════════════════════════════════════════════════
function AcquisitionSection({ data }: { data: Acquisition | null }) {
  if (!data) return <SectionSkeleton title="📥 Adquisición" />;

  const d = deltaPct(data.new_signups, data.new_signups_prev);
  const obLight = lightFor(data.onboarding_rate, { red: 40, yellow: 60 });

  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>📥 Adquisición</h3>

      <div style={cardsGrid}>
        <Kpi
          label="New signups"
          value={data.new_signups}
          delta={d}
        />
        <Kpi
          label="Onboarding %"
          value={`${data.onboarding_rate}%`}
          sub={`${data.onboarding_completed} de ${data.new_signups} completaron`}
          light={obLight}
        />
        <BreakdownCard
          label="Platform"
          entries={Object.entries(data.by_platform)}
          formatKey={(k) => k}
          total={data.new_signups}
        />
        <BreakdownCard
          label="Provider"
          entries={Object.entries(data.by_provider)}
          formatKey={(k) => k}
          total={data.new_signups}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={subtitle}>Top países</div>
        <CountryTable
          rows={data.by_country.top}
          total={data.new_signups}
        />
      </div>

      {data.growth_chart.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <div style={subtitle}>Crecimiento diario</div>
          <GrowthSparkline points={data.growth_chart} />
        </div>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// RETENCIÓN
// ═════════════════════════════════════════════════════════════════════════════
function RetentionSection({ data }: { data: Retention | null }) {
  if (!data) return <SectionSkeleton title="🔁 Retención" />;

  // Standard stickiness includes install-day-only users, so it's a
  // structurally lower number. The "returning" variant (returning-DAU
  // over returning-MAU) is the more meaningful engagement signal —
  // it answers "of users who actually come back, how many are here today".
  const stickyStdLight = lightFor(data.stickiness, { red: 5, yellow: 12 });
  const stickyRetLight = lightFor(data.stickiness_returning, { red: 8, yellow: 15 });

  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>🔁 Retención</h3>

      <div style={cardsGrid}>
        <RetentionPair label="DAU" total={data.dau} returning={data.dau_returning} hint="≥2 sesiones hoy" />
        <RetentionPair label="WAU" total={data.wau} returning={data.wau_returning} hint="≥2 días activos esta semana" />
        <RetentionPair label="MAU" total={data.mau} returning={data.mau_returning} hint="≥2 días activos este mes" />
        <Kpi
          label="Stickiness · returning"
          value={`${data.stickiness_returning}%`}
          sub="rDAU/rMAU — la que importa"
          light={stickyRetLight}
        />
        <Kpi
          label="Stickiness · standard"
          value={`${data.stickiness}%`}
          sub="DAU/MAU — diluida por nuevos signups"
          light={stickyStdLight}
        />
        <Kpi
          label="First-time active"
          value={data.first_time_active}
          sub="Signups que hicieron su 1ra acción esta semana"
        />
        <Kpi
          label="Churn risk"
          value={data.churn_risk}
          sub="Activos 14-30d, sin actividad reciente"
        />
        <Kpi
          label="Resurrected"
          value={data.resurrected}
          sub="Activos esta semana, dormidos ≥30d"
        />
      </div>
    </section>
  );
}

function RetentionPair({
  label, total, returning, hint,
}: { label: string; total: number; returning: number; hint: string }) {
  const ratio = total > 0 ? Math.round((returning / total) * 100) : 0;
  return (
    <div style={kpiCard}>
      <div style={kpiLabel}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={kpiValue}>{formatNumber(total)}</div>
        <div style={{ fontSize: 14, color: "#a855f7", fontWeight: 700 }}>
          ↻ {formatNumber(returning)}
        </div>
      </div>
      <div style={kpiSub}>
        {ratio}% returning · {hint}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPORTAMIENTO
// ═════════════════════════════════════════════════════════════════════════════
function BehaviorSection({ data }: { data: Behavior | null }) {
  if (!data) return <SectionSkeleton title="🎬 Comportamiento" />;

  const ratingDelta = deltaPct(data.ratings.total, data.ratings.prev);
  const commentDelta = deltaPct(data.comments.total, data.comments.prev);
  const watchlistDelta = deltaPct(data.watchlist.total, data.watchlist.prev);
  const peeklistDelta = deltaPct(data.peeklists.created, data.peeklists.prev);

  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>🎬 Comportamiento</h3>
      <p style={{ color: "#fff8", fontSize: 12, marginTop: -4, marginBottom: 16 }}>
        Promedios calculados sobre <strong>{formatNumber(data.active_users)}</strong> usuarios activos en el rango.
      </p>

      <div style={cardsGrid}>
        <Kpi
          label="Ratings"
          value={data.ratings.total}
          delta={ratingDelta}
          sub={`${data.ratings.per_active_avg}/user activo`}
        />
        <Kpi
          label="Comments"
          value={data.comments.total}
          delta={commentDelta}
          sub={`${data.comments.per_active_avg}/user`}
        />
        <Kpi
          label="Watchlist adds"
          value={data.watchlist.total}
          delta={watchlistDelta}
          sub={`${data.watchlist.per_active_avg}/user`}
        />
        <Kpi
          label="Peeklists creadas"
          value={data.peeklists.created}
          delta={peeklistDelta}
          sub={`${data.peeklists.items_added} items · ${data.peeklists.avg_items_per_peeklist}/list`}
        />
        <Kpi
          label="Comment likes"
          value={data.likes.comment_likes_given}
          sub={`${data.likes.comment_likes_received} recibidos`}
        />
        <Kpi
          label="Title likes (♥)"
          value={data.likes.title_likes}
        />
        <Kpi
          label="Follows creados"
          value={data.follows.created}
          sub={`${data.follows.mutual_pct}% mutuales (${data.follows.mutual})`}
        />
        <Kpi
          label="Shares"
          value={data.shares_total}
          sub="Requiere PostHog (1.7.2+)"
          light="neutral"
        />
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TOP CREATORS
// ═════════════════════════════════════════════════════════════════════════════
const TOP_METRIC_LABELS: Record<TopMetric, string> = {
  ratings: "Más ratings",
  comments: "Más comments",
  peeklists: "Más peeklists",
  follower_growth: "Más nuevos followers",
  likes_received: "Más likes recibidos",
};

function TopCreatorsSection({
  creators, metric, setMetric,
}: {
  creators: Creator[];
  metric: TopMetric;
  setMetric: (m: TopMetric) => void;
}) {
  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>👑 Top creators / power users</h3>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {(Object.keys(TOP_METRIC_LABELS) as TopMetric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            style={metric === m ? presetActive : presetBtn}
          >
            {TOP_METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {creators.length === 0 ? (
        <div style={{ color: "#fff6", fontSize: 13 }}>Sin datos en el rango.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {creators.map((c, i) => (
            <div key={c.user_id} style={creatorRow}>
              <div style={{ width: 22, color: "#fff7", fontWeight: 700, fontSize: 12 }}>
                #{i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 600 }}>
                  {c.display_name || c.username}
                  {c.account_type === "creator" && c.creator_status === "approved" && (
                    <span style={creatorBadge}> ✓ creator</span>
                  )}
                </div>
                <div style={{ color: "#fff8", fontSize: 12 }}>@{c.username}</div>
              </div>
              <div style={{ color: "#a855f7", fontWeight: 700, fontSize: 16 }}>
                {formatNumber(c.score)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// REUSABLE PIECES
// ═════════════════════════════════════════════════════════════════════════════
function Kpi({
  label, value, sub, delta, light,
}: {
  label: string;
  value: number | string;
  sub?: string;
  delta?: { pct: number; sign: "up" | "down" | "flat" };
  light?: Light;
}) {
  const lightColor = light ? LIGHT_COLOR[light] : "#fff";
  return (
    <div
      style={{
        ...kpiCard,
        borderColor: light ? LIGHT_COLOR[light] + "55" : "rgba(255,255,255,.08)",
        background: light ? LIGHT_BG[light] : "rgba(255,255,255,.03)",
      }}
    >
      <div style={kpiLabel}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ ...kpiValue, color: lightColor }}>
          {typeof value === "number" ? formatNumber(value) : value}
        </div>
        {delta && delta.sign !== "flat" && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: delta.sign === "up" ? "#10b981" : "#ef4444",
            }}
          >
            {delta.sign === "up" ? "▲" : "▼"} {delta.pct.toFixed(0)}%
          </div>
        )}
      </div>
      {sub && <div style={kpiSub}>{sub}</div>}
    </div>
  );
}

function BreakdownCard({
  label, entries, total, formatKey,
}: {
  label: string;
  entries: [string, number][];
  total: number;
  formatKey: (k: string) => string;
}) {
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  return (
    <div style={kpiCard}>
      <div style={kpiLabel}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        {sorted.length === 0 ? (
          <div style={{ color: "#fff6", fontSize: 12 }}>—</div>
        ) : (
          sorted.map(([k, v]) => {
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#fff" }}>{formatKey(k)}</span>
                <span style={{ color: "#fff9" }}>
                  {formatNumber(v)} <span style={{ color: "#fff5" }}>({pct}%)</span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CountryTable({
  rows, total,
}: {
  rows: { country_code: string; n: number }[];
  total: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {rows.map((r) => {
        const pct = total > 0 ? (r.n / total) * 100 : 0;
        return (
          <div key={r.country_code} style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
              <span style={{ color: "#fff" }}>{countryName(r.country_code)}</span>
              <span style={{ color: "#fff8" }}>{formatNumber(r.n)} ({pct.toFixed(1)}%)</span>
            </div>
            <div style={{ height: 3, background: "#ffffff11", borderRadius: 2 }}>
              <div
                style={{
                  height: 3,
                  width: `${pct}%`,
                  background: "#a855f7",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GrowthSparkline({
  points,
}: { points: { day: string; signups: number; cumulative: number }[] }) {
  const w = 720;
  const h = 100;
  const padding = 4;
  const max = Math.max(...points.map((p) => p.signups), 1);
  const stepX = (w - padding * 2) / Math.max(points.length - 1, 1);

  const linePath = points
    .map((p, i) => {
      const x = padding + i * stepX;
      const y = h - padding - ((p.signups / max) * (h - padding * 2));
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const lastPoint = points[points.length - 1];

  return (
    <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 8, padding: 12 }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 100 }}>
        <path d={linePath} stroke="#a855f7" strokeWidth={2} fill="none" />
        {points.map((p, i) => {
          const x = padding + i * stepX;
          const y = h - padding - ((p.signups / max) * (h - padding * 2));
          return <circle key={i} cx={x} cy={y} r={2.5} fill="#a855f7" />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#fff8" }}>
        <span>{points[0]?.day}</span>
        <span>
          Hoy: <strong style={{ color: "#fff" }}>{formatNumber(lastPoint?.signups ?? 0)}</strong> signups
        </span>
        <span>{lastPoint?.day}</span>
      </div>
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>{title}</h3>
      <div style={{ color: "#fff6", fontSize: 13, padding: "20px 0" }}>Cargando…</div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES (inline — matches the existing admin page pattern)
// ═════════════════════════════════════════════════════════════════════════════
const headerWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const btnPrimary: React.CSSProperties = {
  background: "#FA0082",
  color: "#fff",
  border: 0,
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const errBox: React.CSSProperties = {
  background: "rgba(239,68,68,.12)",
  border: "1px solid rgba(239,68,68,.35)",
  borderRadius: 8,
  padding: 12,
  color: "#fca5a5",
  fontSize: 13,
};

const alertBox: React.CSSProperties = {
  background: "rgba(239,68,68,.08)",
  border: "1px solid rgba(239,68,68,.4)",
  borderRadius: 12,
  padding: 14,
};

const sectionCard: React.CSSProperties = {
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 12,
  padding: 18,
};

const sectionTitle: React.CSSProperties = {
  color: "#fff",
  margin: "0 0 14px",
  fontSize: 17,
  fontWeight: 700,
};

const subtitle: React.CSSProperties = {
  color: "#fff8",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 8,
};

const cardsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const kpiCard: React.CSSProperties = {
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 10,
  padding: 14,
};

const kpiLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#fff8",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  marginBottom: 6,
};

const kpiValue: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  color: "#fff",
  lineHeight: 1.1,
};

const kpiSub: React.CSSProperties = {
  fontSize: 11,
  color: "#fff8",
  marginTop: 6,
};

const filterBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 10,
  padding: 10,
  flexWrap: "wrap",
};

const presetBtn: React.CSSProperties = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.1)",
  color: "#fff9",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const presetActive: React.CSSProperties = {
  ...presetBtn,
  background: "rgba(250,0,130,.18)",
  borderColor: "#FA0082",
  color: "#FA0082",
};

const dateInput: React.CSSProperties = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.1)",
  color: "#fff",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
};

const creatorRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  background: "rgba(255,255,255,.03)",
  borderRadius: 8,
};

const creatorBadge: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 10,
  color: "#a855f7",
  fontWeight: 700,
};

const onboardedToggleBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  background: "rgba(168,85,247,.08)",
  border: "1px solid rgba(168,85,247,.3)",
  borderRadius: 10,
  padding: 12,
};

const toggleBase: React.CSSProperties = {
  width: 44,
  height: 24,
  borderRadius: 99,
  border: 0,
  cursor: "pointer",
  padding: 2,
  display: "flex",
  alignItems: "center",
  transition: "background .2s",
};

const toggleOff: React.CSSProperties = {
  ...toggleBase,
  background: "rgba(255,255,255,.14)",
};

const toggleOn: React.CSSProperties = {
  ...toggleBase,
  background: "#a855f7",
};

const toggleKnob: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 99,
  background: "#fff",
  transition: "transform .2s",
};
