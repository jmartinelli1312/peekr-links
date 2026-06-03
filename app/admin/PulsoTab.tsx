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

// All-time counterpart used to render global "context" cards alongside the
// timeframe-filtered numbers. Lighter than `Acquisition` — no growth chart,
// no prev-period delta (meaningless at all-time scale).
type AcquisitionGlobal = {
  total_users: number;
  onboarding_completed: number;
  onboarding_rate: number;
  by_platform: Record<string, number>;
  by_country: { top: { country_code: string; n: number }[]; other: number };
  by_provider: Record<string, number>;
};

type Retention = {
  dau: number;
  wau: number;
  mau: number;
  stickiness_dau_mau: number;  // DAU / MAU — daily engagement intensity
  stickiness_wau_mau: number;  // WAU / MAU — weekly cadence (the one that matters for Letterboxd-style)
  contributors_dau?: number;  // legacy strict def: explicit action post-install
  contributors_wau?: number;
  contributors_mau?: number;
  churn_risk: number;
  resurrected: number;
  first_time_active: number;
  by_app_version: Record<string, number>;
};

// Week-over-Week retention: for each base week, what % of users active in
// that week came back the next week? Most meaningful retention metric for
// movie-tracking apps (Letterboxd benchmark is ~30-40%).
type WoWRetention = {
  base_weeks: string[];      // ISO date of week start
  base_active: number[];     // users active in that base week
  retained: number[];        // of those, how many were active the next week
  retention_pct: number[];   // retained / base_active * 100
};

// Per-cohort retention curve. Used to compare acquisition sources side-by-side
// (e.g., Kevin PA reel vs pelisaldetalle AR reel). A cohort is one
// (signup_week × country_bucket) combination.
type Cohort = {
  week_start: string;          // ISO date of the week start
  bucket: "AR" | "PA" | "Other";
  size: number;
  age_days: number;
  ever_returned_pct: number;
  // null if the cohort isn't old enough for that window to be observable
  w1_pct: number | null;       // days 1-7 post-install
  w2_pct: number | null;       // days 8-14
  w3_pct: number | null;       // days 15-21
  w4_pct: number | null;       // days 22-28
};

type Behavior = {
  active_users: number;
  /** Active users that signed up BEFORE the range — matches DAU. */
  active_users_mature?: number;
  /** Active users that signed up during the range (their first day). */
  active_users_install_day?: number;
  /** Signups in the range (whether they did anything else or not). */
  signups_in_range?: number;
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
  /** Legacy: rating-only North Star (mature accounts that rated this week) */
  north_star_war_returning: number;
  /** Current North Star: any meaningful action + mature account */
  north_star_weu_returning: number;
  shares_total: number;
};

type TimeSeries = {
  days: string[];
  retention: {
    dau: number[];
    signups: number[];
    first_time_active: number[];
  };
  behavior: {
    ratings: number[];
    comments: number[];
    watchlist: number[];
    peeklists: number[];
    likes: number[];
    follows: number[];
  };
};

type RetentionSeries = keyof TimeSeries["retention"];
type BehaviorSeries = keyof TimeSeries["behavior"];

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
  const [acquisitionGlobal, setAcquisitionGlobal] = useState<AcquisitionGlobal | null>(null);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [wowRetention, setWowRetention] = useState<WoWRetention | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[] | null>(null);
  const [behavior, setBehavior] = useState<Behavior | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeries | null>(null);
  const [appEngagement, setAppEngagement] = useState<AppEngagement | null>(null);
  const [retentionTab, setRetentionTab] = useState<RetentionSeries>("dau");
  const [behaviorTab, setBehaviorTab] = useState<BehaviorSeries>("ratings");
  const [topMetric, setTopMetric] = useState<TopMetric>("ratings");
  const [topCreators, setTopCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { fromTs, toTsExclusive } = artRangeToUtcIso(range);

      const [acqRes, acqGlobalRes, retRes, wowRes, cohortRes, behRes, tsRes, appRes] = await Promise.all([
        supabase.rpc("admin_kpi_acquisition", {
          p_from: fromTs,
          p_to_exclusive: toTsExclusive,
        }),
        supabase.rpc("admin_kpi_acquisition_global"),
        supabase.rpc("admin_kpi_retention", {
          p_only_onboarded: onlyOnboarded,
        }),
        supabase.rpc("admin_kpi_wow_retention", {
          p_weeks: 8,
        }),
        supabase.rpc("admin_kpi_cohort_retention", {
          p_weeks: 10,
        }),
        supabase.rpc("admin_kpi_behavior", {
          p_from: fromTs,
          p_to_exclusive: toTsExclusive,
          p_only_onboarded: onlyOnboarded,
        }),
        supabase.rpc("admin_kpi_time_series", {
          p_from: fromTs,
          p_to_exclusive: toTsExclusive,
          p_only_onboarded: onlyOnboarded,
        }),
        supabase.rpc("admin_kpi_app_engagement", {
          p_from: fromTs,
          p_to_exclusive: toTsExclusive,
        }),
      ]);

      if (acqRes.error) throw acqRes.error;
      if (acqGlobalRes.error) throw acqGlobalRes.error;
      if (retRes.error) throw retRes.error;
      if (wowRes.error) throw wowRes.error;
      if (cohortRes.error) throw cohortRes.error;
      if (behRes.error) throw behRes.error;
      if (tsRes.error) throw tsRes.error;
      if (appRes.error) throw appRes.error;

      setAcquisition(acqRes.data as Acquisition);
      setAcquisitionGlobal(acqGlobalRes.data as AcquisitionGlobal);
      setRetention(retRes.data as Retention);
      setWowRetention(wowRes.data as WoWRetention);
      setCohorts(cohortRes.data as Cohort[]);
      setBehavior(behRes.data as Behavior);
      setTimeSeries(tsRes.data as TimeSeries);
      setAppEngagement(appRes.data as AppEngagement);
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
      const weuLight = lightFor(behavior.north_star_weu_returning, {
        red: 100,
        yellow: 250,
      });
      if (weuLight === "red")
        list.push(
          `North Star (WEU returning) = ${behavior.north_star_weu_returning}. Pocos users establecidos están activos esta semana.`
        );
    }
    if (retention) {
      // For movie-tracking (Letterboxd-style) apps the meaningful cadence is
      // weekly, not daily. WAU/MAU is the right signal here — Letterboxd sits
      // around 35-45%. Below 20% means even weekly users churn fast.
      const stkLight = lightFor(retention.stickiness_wau_mau, { red: 20, yellow: 35 });
      if (stkLight === "red")
        list.push(
          `Stickiness semanal (WAU/MAU) = ${retention.stickiness_wau_mau}%. Letterboxd está en ~35-45% — estás abajo del piso.`
        );
    }
    if (wowRetention && wowRetention.retention_pct.length > 0) {
      const last = wowRetention.retention_pct[wowRetention.retention_pct.length - 1];
      const wowLight = lightFor(last, { red: 20, yellow: 30 });
      if (wowLight === "red")
        list.push(
          `Retención WoW = ${last}%. Letterboxd está en ~30-40%. La semana pasada los activos no volvieron esta semana.`
        );
    }
    return list;
  }, [acquisition, retention, wowRetention, behavior]);

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

      {/* ═════ 1. ADQUISICIÓN (con globales) ═════ */}
      <AcquisitionSection data={acquisition} globalData={acquisitionGlobal} />

      {/* ═════ 2. RETENCIÓN (con North Star + Alertas adentro) ═════ */}
      <RetentionSection
        data={retention}
        wow={wowRetention}
        series={timeSeries}
        tab={retentionTab}
        setTab={setRetentionTab}
        behavior={behavior}
        alerts={alerts}
      />

      {/* ═════ 3. COMPORTAMIENTO ═════ */}
      <BehaviorSection
        data={behavior}
        series={timeSeries}
        tab={behaviorTab}
        setTab={setBehaviorTab}
      />

      {/* ═════ 3.5 USO DE LA APP (tiempo + secciones) ═════ */}
      <AppEngagementSection data={appEngagement} />

      {/* ═════ 4. COHORTS ═════ */}
      <CohortRetentionSection cohorts={cohorts} />

      {/* ═════ 5. TOP CREATORS ═════ */}
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
// ═════════════════════════════════════════════════════════════════════════════
// USO DE LA APP (tiempo + secciones navegadas, desde screen_views)
// ═════════════════════════════════════════════════════════════════════════════
type AppSection = {
  screen: string;
  views: number;
  users: number;
  total_min: number;
  avg_sec: number;
};
type AppEngagement = {
  active_users: number;
  total_minutes: number;
  avg_min_per_user: number;
  median_min_per_user: number;
  avg_sec_per_screen: number;
  top_sections: AppSection[];
};

// Onboarding/auth funnel screens — excluded from "secciones más navegadas".
const ONBOARDING_SCREENS = new Set([
  "/intro-carousel", "/post-signup", "/auth-landing", "/login-callback",
  "/follow-onboarding-seen", "/onboarding", "/signup", "/guest-lock",
]);

const SECTION_LABELS: Record<string, string> = {
  "/title/:type/:id": "Ficha de título",
  "/detail": "Detalle de título",
  "/actor/:id": "Actor",
  "/u/:username": "Perfil de usuario",
  "/profile/peeklists/:id": "Peeklist",
  "/watchlist": "Watchlist",
  "/follow-list": "Seguidores / Siguiendo",
  "/inbox/chat/:id": "Chat",
  "/inbox/new": "Nuevo chat",
  "/settings": "Ajustes",
  "/settings/about": "Acerca de",
  "/edit-profile": "Editar perfil",
};

function sectionLabel(screen: string): string {
  return SECTION_LABELS[screen] ?? screen;
}

function AppEngagementSection({ data }: { data: AppEngagement | null }) {
  if (!data) return null;
  const sections = (data.top_sections ?? []).filter(
    (s) => !ONBOARDING_SCREENS.has(s.screen)
  );
  const maxViews = sections.reduce((m, s) => Math.max(m, s.views), 0) || 1;

  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>📱 Uso de la app</h3>
      <p style={{ color: "#fff8", fontSize: 12, marginTop: -4, marginBottom: 14 }}>
        Tiempo en app y secciones más navegadas (<strong style={{ color: "#fff" }}>screen_views</strong>,
        desde 29-may). Duración capada a 10 min/pantalla para descartar app en background.
      </p>

      <div style={cardsGrid}>
        <Kpi label="Tiempo / usuario" value={`${data.avg_min_per_user} min`} sub={`Mediana: ${data.median_min_per_user} min`} />
        <Kpi label="Tiempo total" value={`${Math.round(data.total_minutes / 60)} h`} sub={`${formatNumber(data.total_minutes)} min en el período`} />
        <Kpi label="Por pantalla" value={`${data.avg_sec_per_screen}s`} sub="Promedio por vista" />
        <Kpi label="Usuarios con navegación" value={data.active_users} sub="Distintos en el período" />
      </div>

      <div style={{ ...subtitle, marginTop: 18 }}>Secciones más navegadas</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {sections.length === 0 ? (
          <div style={{ fontSize: 13, color: "#fff6" }}>Sin datos en el período</div>
        ) : (
          sections.map((s) => (
            <div key={s.screen} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 150, fontSize: 13, color: "#fffc" }}>{sectionLabel(s.screen)}</div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 20, position: "relative" }}>
                <div style={{ width: `${(s.views / maxViews) * 100}%`, background: "#FA0082", height: "100%", borderRadius: 6, minWidth: 2 }} />
              </div>
              <div style={{ width: 175, textAlign: "right", fontSize: 12, color: "#fff9" }}>
                {formatNumber(s.views)} vistas · {formatNumber(s.users)} users · {s.avg_sec}s
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function NorthStarCard({ behavior }: { behavior: Behavior | null }) {
  const value = behavior?.north_star_weu_returning ?? 0;
  const ratersValue = behavior?.north_star_war_returning ?? 0;
  const light = lightFor(value, { red: 100, yellow: 250 });

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
        🌟 NORTH STAR — Weekly Engaged Returners
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
          users con cuenta ≥7d que volvieron esta semana
          <br />
          <span style={{ fontSize: 12, color: "#fff6" }}>
            (navegaron contenido o hicieron una acción: rate / comment /
            watchlist / like / follow)
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 12, color: "#fff9", alignItems: "center" }}>
        <span>🔴 &lt; 100</span>
        <span>🟡 100 – 250</span>
        <span>🟢 ≥ 250</span>
        <span style={{ marginLeft: "auto", color: "#fff6" }}>
          De esos, <strong style={{ color: "#fff" }}>{formatNumber(ratersValue)}</strong> ratearon (quality signal)
        </span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ADQUISICIÓN
// ═════════════════════════════════════════════════════════════════════════════
function AcquisitionSection({
  data, globalData,
}: {
  data: Acquisition | null;
  globalData: AcquisitionGlobal | null;
}) {
  if (!data) return <SectionSkeleton title="📥 Adquisición" />;

  const d = deltaPct(data.new_signups, data.new_signups_prev);
  const obLight = lightFor(data.onboarding_rate, { red: 40, yellow: 60 });
  const obGlobalLight = globalData
    ? lightFor(globalData.onboarding_rate, { red: 40, yellow: 60 })
    : "neutral";

  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>📥 Adquisición</h3>

      {/* ── Timeframe row ── */}
      <div style={subtitle}>📅 En el rango seleccionado</div>
      <div style={cardsGrid}>
        <Kpi
          label="New signups"
          value={data.new_signups}
          delta={d}
        />
        <Kpi
          label="Onboarding %"
          value={`${data.onboarding_rate}%`}
          sub={`${data.onboarding_completed}/${data.new_signups} completaron · 🎯 industria 70-80%`}
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

      {/* ── Global row (all-time) ── */}
      {globalData && (
        <>
          <div style={{ ...subtitle, marginTop: 18 }}>🌐 Global (all-time)</div>
          <div style={cardsGrid}>
            <Kpi
              label="Global users"
              value={globalData.total_users}
              sub="Total signups desde el día 1"
            />
            <Kpi
              label="Onboarding % global"
              value={`${globalData.onboarding_rate}%`}
              sub={`${globalData.onboarding_completed}/${globalData.total_users} completaron · 🎯 industria 70-80%`}
              light={obGlobalLight}
            />
            <BreakdownCard
              label="Platform global"
              entries={Object.entries(globalData.by_platform)}
              formatKey={(k) => k}
              total={globalData.total_users}
            />
            <BreakdownCard
              label="Provider global"
              entries={Object.entries(globalData.by_provider)}
              formatKey={(k) => k}
              total={globalData.total_users}
            />
          </div>
        </>
      )}

      {/* ── Top países: timeframe luego global ── */}
      <div style={{ marginTop: 18 }}>
        <div style={subtitle}>Top países · rango</div>
        <CountryTable
          rows={data.by_country.top}
          total={data.new_signups}
        />
      </div>

      {globalData && (
        <div style={{ marginTop: 18 }}>
          <div style={subtitle}>Top países · global</div>
          <CountryTable
            rows={globalData.by_country.top}
            total={globalData.total_users}
          />
        </div>
      )}

      {data.growth_chart.length > 1 && (
        <div style={{ marginTop: 18 }}>
          <div style={subtitle}>Crecimiento diario · rango</div>
          <GrowthSparkline points={data.growth_chart} />
        </div>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// RETENCIÓN
// ═════════════════════════════════════════════════════════════════════════════
const RETENTION_TAB_LABELS: Record<RetentionSeries, string> = {
  dau: "DAU (activos por día)",
  signups: "Nuevos signups",
  first_time_active: "First-time active",
};

function RetentionSection({
  data, wow, series, tab, setTab, behavior, alerts,
}: {
  data: Retention | null;
  wow: WoWRetention | null;
  series: TimeSeries | null;
  tab: RetentionSeries;
  setTab: (t: RetentionSeries) => void;
  behavior: Behavior | null;
  alerts: string[];
}) {
  if (!data) return <SectionSkeleton title="🔁 Retención" />;

  // For Letterboxd-style movie-tracking apps the natural cadence is weekly,
  // not daily. Stickiness WAU/MAU is the headline number — Letterboxd sits
  // around 35-45%. DAU/MAU is shown for completeness but is naturally low
  // (Letterboxd ~12-15%); we use it more for intensity than as the bar.
  const stickyDauLight = lightFor(data.stickiness_dau_mau, { red: 8, yellow: 12 });
  const stickyWauLight = lightFor(data.stickiness_wau_mau, { red: 20, yellow: 35 });

  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>🔁 Retención</h3>

      {/* North Star (Weekly Engaged Returners) — la métrica que importa */}
      <div style={{ marginBottom: 14 }}>
        <NorthStarCard behavior={behavior} />
      </div>

      {/* Alertas activas — semáforos en rojo */}
      {alerts.length > 0 && (
        <div style={{ ...alertBox, marginBottom: 14 }}>
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

      <p style={{ color: "#fff8", fontSize: 12, marginTop: -4, marginBottom: 14 }}>
        <strong style={{ color: "#fff" }}>Uso real</strong> = abrió y navegó
        contenido (ficha, detalle, actor, perfil…) <em>o</em> hizo una acción
        (rate / comment / watchlist / like / follow). Incluye el día de install.
        Entre paréntesis, <strong style={{ color: "#fff" }}>contribuidores</strong>{" "}
        (solo acciones explícitas post-install — la métrica anterior).{" "}
        <span style={{ color: "#fbbf24" }}>
          Nota: la navegación se trackea desde 29-may, así que WAU/MAU y su ratio
          aún se están llenando (stickiness puede verse alto temporalmente).
        </span>
      </p>

      <div style={cardsGrid}>
        <Kpi
          label="DAU"
          value={data.dau}
          sub={`Uso real hoy${data.contributors_dau != null ? ` · contrib: ${data.contributors_dau}` : ""}`}
        />
        <Kpi
          label="WAU"
          value={data.wau}
          sub={`Uso real 7d${data.contributors_wau != null ? ` · contrib: ${data.contributors_wau}` : ""}`}
        />
        <Kpi
          label="MAU"
          value={data.mau}
          sub={`Uso real 30d${data.contributors_mau != null ? ` · contrib: ${data.contributors_mau}` : ""}`}
        />
        <Kpi
          label="Stickiness · WAU/MAU"
          value={`${data.stickiness_wau_mau}%`}
          sub="🎯 Letterboxd ~35-45% — la métrica clave"
          light={stickyWauLight}
        />
        <Kpi
          label="Stickiness · DAU/MAU"
          value={`${data.stickiness_dau_mau}%`}
          sub="🎯 Letterboxd ~12-15% (intensidad diaria)"
          light={stickyDauLight}
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

      {/* WoW retention — most meaningful retention metric for movie apps */}
      {wow && wow.base_weeks.length > 1 && (
        <div style={{ marginTop: 18 }}>
          <WoWRetentionCard wow={wow} />
        </div>
      )}

      {series && series.days.length > 1 && (
        <div style={{ marginTop: 18 }}>
          <div style={subtitle}>Evolución</div>
          <TabSwitcher
            tabs={(Object.keys(RETENTION_TAB_LABELS) as RetentionSeries[]).map((k) => ({
              key: k,
              label: RETENTION_TAB_LABELS[k],
            }))}
            active={tab}
            onChange={setTab}
          />
          <div style={{ marginTop: 8 }}>
            <MetricSparkline
              days={series.days}
              values={series.retention[tab]}
              label={RETENTION_TAB_LABELS[tab]}
              aggregateMode={tab === "dau" || tab === "signups" ? "avg" : "sum"}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// Week-over-Week retention card — shows the % of users active in week N who
// came back in week N+1. Most meaningful retention number for Letterboxd-style
// apps because viewing cadence is naturally weekly, not daily.
function WoWRetentionCard({ wow }: { wow: WoWRetention }) {
  // The last base week measures retention against the *current* (in-progress)
  // week — so its number is artificially low. The previous base week is the
  // last "complete" data point, and that's what we headline.
  const completeIdx = Math.max(wow.retention_pct.length - 2, 0);
  const headline = wow.retention_pct[completeIdx] ?? 0;
  const headlineBase = wow.base_weeks[completeIdx] ?? "";
  const inProgress = wow.retention_pct[wow.retention_pct.length - 1] ?? 0;
  const inProgressBase = wow.base_weeks[wow.base_weeks.length - 1] ?? "";
  const hasInProgress = wow.retention_pct.length > 1;
  const light = lightFor(headline, { red: 20, yellow: 30 });

  return (
    <div
      style={{
        background: LIGHT_BG[light],
        border: `1px solid ${LIGHT_COLOR[light]}55`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={kpiLabel}>Retención WoW (semana → semana siguiente)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{ ...kpiValue, color: LIGHT_COLOR[light], fontSize: 32 }}>
              {headline}%
            </div>
            <div style={{ fontSize: 12, color: "#fff8" }}>
              base: {headlineBase}
              {hasInProgress && (
                <>
                  <br />
                  <span style={{ color: "#fff6" }}>
                    semana actual (parcial): {inProgress}% sobre base {inProgressBase}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#fff8", textAlign: "right" }}>
          🎯 <strong style={{ color: "#fff" }}>Letterboxd ~30-40%</strong>
          <br />
          <span style={{ color: "#fff6" }}>
            🔴 &lt; 20% &nbsp; 🟡 20-30% &nbsp; 🟢 ≥ 30%
          </span>
        </div>
      </div>
      <WoWRetentionChart wow={wow} />
    </div>
  );
}

function WoWRetentionChart({ wow }: { wow: WoWRetention }) {
  const w = 720;
  const h = 130;
  const padding = 8;
  const pcts = wow.retention_pct;
  const max = Math.max(...pcts, 50); // ceiling at least 50 to make Letterboxd line visible
  const stepX = (w - padding * 2) / Math.max(pcts.length - 1, 1);

  const linePath = pcts
    .map((v, i) => {
      const x = padding + i * stepX;
      const y = h - padding - ((v / max) * (h - padding * 2));
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  // Letterboxd benchmark line at 35% (mid of the 30-40% range)
  const letterboxdY = h - padding - ((35 / max) * (h - padding * 2));

  return (
    <div style={{ marginTop: 10 }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 130 }}>
        {/* Letterboxd benchmark line */}
        <line
          x1={padding}
          x2={w - padding}
          y1={letterboxdY}
          y2={letterboxdY}
          stroke="#fbbf24"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.7}
        />
        <text x={w - padding - 4} y={letterboxdY - 4} fill="#fbbf24" fontSize={10} textAnchor="end">
          Letterboxd ~35%
        </text>

        {/* our line */}
        <path d={linePath} stroke="#a855f7" strokeWidth={2.5} fill="none" />
        {pcts.map((v, i) => {
          const x = padding + i * stepX;
          const y = h - padding - ((v / max) * (h - padding * 2));
          // last point is in-progress (current week not yet complete)
          const isInProgress = i === pcts.length - 1 && pcts.length > 1;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isInProgress ? 3.5 : 3}
              fill={isInProgress ? "transparent" : "#a855f7"}
              stroke="#a855f7"
              strokeWidth={isInProgress ? 2 : 0}
              strokeDasharray={isInProgress ? "2 2" : undefined}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#fff8" }}>
        {wow.base_weeks.map((wk, i) => {
          // show every other label to avoid clutter
          if (wow.base_weeks.length > 6 && i % 2 !== 0 && i !== wow.base_weeks.length - 1) {
            return <span key={wk} />;
          }
          return (
            <span key={wk} style={{ textAlign: "center", flex: 1 }}>
              {wk.slice(5)}
              <br />
              <strong style={{ color: "#fff" }}>{wow.retention_pct[i]}%</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COHORT RETENTION (compare acquisition sources)
//
// Each row is one signup-week × country (AR / PA / Other). Columns show what
// % of that cohort came back in week 1, 2, 3, 4 post-install. Lets you spot
// at a glance which campaigns brought users that stuck — and crucially,
// compare paid IG cohorts (the big ones in May) against the small organic
// baseline of earlier weeks.
// ═════════════════════════════════════════════════════════════════════════════
const BUCKET_LABEL: Record<Cohort["bucket"], string> = {
  AR: "🇦🇷 Argentina",
  PA: "🇵🇦 Panamá",
  Other: "🌎 Otros",
};

// Known campaign WINDOWS — used to overlay context onto cohorts. We do NOT
// claim "this cohort came from X" because we have zero per-user attribution
// today (no UTM, no ref code, no self-report). We just list every campaign
// whose active window intersected the cohort's week. The cohort can include
// users from multiple campaigns + organic; the table makes that uncertainty
// visible instead of pretending we know.
//
// Use "2099-01-01" as `to` for campaigns still running.
type KnownCampaign = { from: string; to: string; label: string; kind: "paid" | "organic" };
const KNOWN_CAMPAIGNS: Record<Cohort["bucket"], KnownCampaign[]> = {
  PA: [
    // Kevin posted his reel organically May 3. The same reel was then boosted
    // as a paid Meta ad starting May 12. Both Boost Post engagement campaigns
    // were paused May 28 once we discovered they were optimizing for
    // engagement (not installs) — that's why none of the spent $328 showed
    // up as attributed installs in Meta. The new App Promotion campaigns
    // launched May 29 (separated into Android + iOS ad sets within the
    // same campaign for clean platform-level reporting).
    { from: "2026-05-03", to: "2026-05-11", label: "Kevin reel orgánico", kind: "organic" },
    { from: "2026-05-12", to: "2026-05-28", label: "Kevin reel boosted (Engagement obj.)", kind: "paid" },
    { from: "2026-05-13", to: "2026-05-16", label: "@elchotin.xyz carrusel", kind: "organic" },
    { from: "2026-05-29", to: "2099-01-01", label: "Kevin reel — Android (App Installs)", kind: "paid" },
    { from: "2026-05-29", to: "2099-01-01", label: "Kevin reel — iOS (App Installs)", kind: "paid" },
  ],
  AR: [
    // The May 24 pelisaldetalle ad was also an Engagement-objective Boost
    // Post — paused May 28 alongside Kevin's once we caught the mistake.
    // App Promotion variants relaunched May 29 with proper conversion
    // optimization + CAPI signal.
    { from: "2026-05-24", to: "2026-05-28", label: "pelisaldetalle reel (Engagement obj.)", kind: "paid" },
    { from: "2026-05-29", to: "2099-01-01", label: "pelisaldetalle reel — Android (App Installs)", kind: "paid" },
    { from: "2026-05-29", to: "2099-01-01", label: "pelisaldetalle reel — iOS (App Installs)", kind: "paid" },
  ],
  Other: [],
};

function campaignsActiveDuring(cohort: Cohort): KnownCampaign[] {
  const camps = KNOWN_CAMPAIGNS[cohort.bucket] ?? [];
  // The cohort's week spans [week_start, week_start+6]. A campaign is active
  // in the cohort if its window overlaps that range at all.
  const weekStart = cohort.week_start;
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  const weekEnd = d.toISOString().slice(0, 10);
  return camps.filter((c) => c.from <= weekEnd && c.to >= weekStart);
}

function cohortLight(pct: number | null): Light {
  if (pct === null) return "neutral";
  if (pct >= 30) return "green";   // Letterboxd-territory
  if (pct >= 15) return "yellow";
  return "red";
}

function CohortRetentionSection({ cohorts }: { cohorts: Cohort[] | null }) {
  if (!cohorts) return <SectionSkeleton title="🧪 Cohorts por origen" />;
  if (cohorts.length === 0) {
    return (
      <section style={sectionCard}>
        <h3 style={sectionTitle}>🧪 Cohorts por origen</h3>
        <div style={{ color: "#fff6", fontSize: 13 }}>
          Sin cohorts con ≥3 usuarios.
        </div>
      </section>
    );
  }

  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>🧪 Cohorts por semana × país</h3>
      <p style={{ color: "#fff8", fontSize: 12, marginTop: -4, marginBottom: 14 }}>
        Cada fila = una semana de signups × país. <strong style={{ color: "#fff" }}>W1-W4</strong>{" "}
        son los % de la cohort que hicieron alguna acción post-install en esa ventana
        de 7 días. <strong style={{ color: "#fff" }}>—</strong> = cohort muy joven aún.
        🎯 Letterboxd ~30-40% W1.
      </p>
      <div style={{
        background: "rgba(245,158,11,.08)",
        border: "1px solid rgba(245,158,11,.3)",
        borderRadius: 8,
        padding: 10,
        marginBottom: 14,
        fontSize: 11,
        color: "#fcd34d",
        lineHeight: 1.5,
      }}>
        ⚠️ <strong>No tenemos atribución por usuario.</strong> Los chips son las campañas
        que estaban <em>activas</em> durante la semana de signup, no la fuente
        confirmada del user. Cuando hay 2+ chips activos en la misma semana, los users
        de esa cohort son una mezcla desconocida (Kevin paid + @elchotin.xyz + orgánico).
        Para arreglar esto: hace falta UTM tagging o ref code en los links de IG.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={cohortTable}>
          <thead>
            <tr>
              <th style={th}>Semana</th>
              <th style={th}>Origen</th>
              <th style={{ ...th, textAlign: "right" }}>Size</th>
              <th style={{ ...th, textAlign: "right" }}>Age</th>
              <th style={{ ...th, textAlign: "right" }}>Ever</th>
              <th style={{ ...th, textAlign: "right" }}>W1</th>
              <th style={{ ...th, textAlign: "right" }}>W2</th>
              <th style={{ ...th, textAlign: "right" }}>W3</th>
              <th style={{ ...th, textAlign: "right" }}>W4</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c, i) => (
              <CohortRow key={`${c.week_start}-${c.bucket}-${i}`} cohort={c} />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "#fff7", lineHeight: 1.7 }}>
        🔴 &lt; 15% &nbsp; 🟡 15-30% &nbsp; 🟢 ≥ 30% &nbsp;·&nbsp; cohorts con &lt;3 users se ocultan.
      </div>
    </section>
  );
}

function CohortRow({ cohort }: { cohort: Cohort }) {
  return (
    <tr style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
      <td style={td}>
        <span style={{ color: "#fff", fontWeight: 600 }}>{cohort.week_start}</span>
      </td>
      <td style={td}>
        <div style={{ color: "#fff", fontWeight: 600 }}>{BUCKET_LABEL[cohort.bucket]}</div>
        <CampaignChips cohort={cohort} />
      </td>
      <td style={{ ...td, textAlign: "right", color: "#fff" }}>{formatNumber(cohort.size)}</td>
      <td style={{ ...td, textAlign: "right", color: "#fff8" }}>{cohort.age_days}d</td>
      <td style={{ ...td, textAlign: "right" }}>
        <PctCell pct={cohort.ever_returned_pct} />
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        <PctCell pct={cohort.w1_pct} traffic />
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        <PctCell pct={cohort.w2_pct} traffic />
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        <PctCell pct={cohort.w3_pct} traffic />
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        <PctCell pct={cohort.w4_pct} traffic />
      </td>
    </tr>
  );
}

function CampaignChips({ cohort }: { cohort: Cohort }) {
  const active = campaignsActiveDuring(cohort);
  if (active.length === 0) {
    return (
      <div style={{ color: "#fff5", fontSize: 10 }}>
        sin campaña conocida · orgánico + otras
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
      {active.map((c) => (
        <span
          key={c.label}
          title={`${c.kind === "paid" ? "Pago" : "Orgánico"} · ${c.from} → ${c.to === "2099-01-01" ? "ongoing" : c.to}`}
          style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 4,
            background: c.kind === "paid" ? "rgba(250,0,130,.15)" : "rgba(168,85,247,.15)",
            color: c.kind === "paid" ? "#FA0082" : "#a855f7",
            border: `1px solid ${c.kind === "paid" ? "#FA008255" : "#a855f755"}`,
          }}
        >
          {c.kind === "paid" ? "💰" : "📱"} {c.label}
        </span>
      ))}
      {active.length > 1 && (
        <span style={{ fontSize: 9, color: "#f59e0b", marginLeft: 4 }}>
          ⚠️ overlap — no podemos atribuir por user
        </span>
      )}
    </div>
  );
}

function PctCell({ pct, traffic = false }: { pct: number | null; traffic?: boolean }) {
  if (pct === null) {
    return <span style={{ color: "#fff5" }}>—</span>;
  }
  if (!traffic) {
    return <span style={{ color: "#fff", fontWeight: 600 }}>{pct}%</span>;
  }
  const light = cohortLight(pct);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 6,
        background: LIGHT_BG[light],
        color: LIGHT_COLOR[light],
        fontWeight: 700,
        fontSize: 12,
        minWidth: 44,
      }}
    >
      {pct}%
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPORTAMIENTO
// ═════════════════════════════════════════════════════════════════════════════
const BEHAVIOR_TAB_LABELS: Record<BehaviorSeries, string> = {
  ratings: "Ratings",
  comments: "Comments",
  watchlist: "Watchlist adds",
  peeklists: "Peeklists creadas",
  likes: "Likes (comment + title)",
  follows: "Follows",
};

function BehaviorSection({
  data, series, tab, setTab,
}: {
  data: Behavior | null;
  series: TimeSeries | null;
  tab: BehaviorSeries;
  setTab: (t: BehaviorSeries) => void;
}) {
  if (!data) return <SectionSkeleton title="🎬 Comportamiento" />;

  const ratingDelta = deltaPct(data.ratings.total, data.ratings.prev);
  const commentDelta = deltaPct(data.comments.total, data.comments.prev);
  const watchlistDelta = deltaPct(data.watchlist.total, data.watchlist.prev);
  const peeklistDelta = deltaPct(data.peeklists.created, data.peeklists.prev);

  // Breakdown of active users between newly-signed-up-in-range vs returning.
  // Older RPC responses don't include the breakdown — fall back to a
  // single-line label in that case.
  const mature = data.active_users_mature;
  const installDay = data.active_users_install_day;
  const hasBreakdown =
    typeof mature === "number" && typeof installDay === "number";

  return (
    <section style={sectionCard}>
      <h3 style={sectionTitle}>🎬 Comportamiento</h3>
      <p style={{ color: "#fff8", fontSize: 12, marginTop: -4, marginBottom: 16 }}>
        Promedios calculados sobre <strong>{formatNumber(data.active_users)}</strong> usuarios activos en el rango
        {hasBreakdown && (
          <>
            {" "}
            <span style={{ color: "#fff5" }}>
              ({formatNumber(mature!)} retornantes + {formatNumber(installDay!)} nuevos en el rango)
            </span>
          </>
        )}
        .
      </p>

      <div style={cardsGrid}>
        <Kpi
          label="Ratings"
          value={data.ratings.total}
          delta={ratingDelta}
          sub={`${data.ratings.per_active_avg}/user activo · 🎯 Letterboxd ~5-10/mes`}
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
          sub={`${data.watchlist.per_active_avg}/user · 🎯 Letterboxd ~3-5/mes`}
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

      {series && series.days.length > 1 && (
        <div style={{ marginTop: 18 }}>
          <div style={subtitle}>Evolución</div>
          <TabSwitcher
            tabs={(Object.keys(BEHAVIOR_TAB_LABELS) as BehaviorSeries[]).map((k) => ({
              key: k,
              label: BEHAVIOR_TAB_LABELS[k],
            }))}
            active={tab}
            onChange={setTab}
          />
          <div style={{ marginTop: 8 }}>
            <MetricSparkline
              days={series.days}
              values={series.behavior[tab]}
              label={BEHAVIOR_TAB_LABELS[tab]}
            />
          </div>
        </div>
      )}
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

// Generic tab switcher used by the trend charts in Retención / Comportamiento.
function TabSwitcher<K extends string>({
  tabs, active, onChange,
}: {
  tabs: { key: K; label: string }[];
  active: K;
  onChange: (k: K) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={active === t.key ? presetActive : presetBtn}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Line chart for a single time series. Shows summary stats and a soft trend
// line so you can eyeball whether the metric is improving.
//
// `aggregateMode` controls which summary is most meaningful:
//   - "sum"  → cumulative count is sensible (events: ratings, comments, follows…)
//   - "avg"  → daily-active counts where summing would double-count users
//             active multiple days (DAU, signups). Shows avg + peak instead.
function MetricSparkline({
  days, values, label, aggregateMode = "sum",
}: {
  days: string[];
  values: number[];
  label: string;
  aggregateMode?: "sum" | "avg";
}) {
  const w = 720;
  const h = 130;
  const padding = 6;
  const safeValues = values.length === days.length ? values : days.map(() => 0);
  const max = Math.max(...safeValues, 1);
  const stepX = (w - padding * 2) / Math.max(days.length - 1, 1);

  const linePath = days
    .map((_, i) => {
      const x = padding + i * stepX;
      const y = h - padding - ((safeValues[i] / max) * (h - padding * 2));
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  // 7-day moving average to show the underlying trend
  const ma7 = safeValues.map((_, i) => {
    const start = Math.max(0, i - 6);
    const slice = safeValues.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const maPath = ma7
    .map((v, i) => {
      const x = padding + i * stepX;
      const y = h - padding - ((v / max) * (h - padding * 2));
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const lastValue = safeValues[safeValues.length - 1] ?? 0;
  const firstValue = safeValues[0] ?? 0;
  const totalSum = safeValues.reduce((a, b) => a + b, 0);
  const peak = Math.max(...safeValues, 0);
  const avg = safeValues.length > 0 ? totalSum / safeValues.length : 0;
  const trend =
    firstValue === 0
      ? "—"
      : `${lastValue > firstValue ? "▲" : lastValue < firstValue ? "▼" : "→"} ${
          firstValue > 0
            ? Math.abs(((lastValue - firstValue) / firstValue) * 100).toFixed(0)
            : 0
        }%`;
  const trendColor =
    lastValue > firstValue
      ? "#10b981"
      : lastValue < firstValue
        ? "#ef4444"
        : "#fff8";

  return (
    <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 8, padding: 12 }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 130 }}>
        {/* moving average */}
        <path d={maPath} stroke="#a855f733" strokeWidth={6} fill="none" strokeLinecap="round" />
        {/* main line */}
        <path d={linePath} stroke="#a855f7" strokeWidth={2} fill="none" />
        {days.map((_, i) => {
          const x = padding + i * stepX;
          const y = h - padding - ((safeValues[i] / max) * (h - padding * 2));
          return <circle key={i} cx={x} cy={y} r={2.2} fill="#a855f7" />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#fff8" }}>
        <span>{days[0]}</span>
        <span>
          <span style={{ color: "#fff" }}>{label}</span> ·
          {" "}último: <strong style={{ color: "#fff" }}>{formatNumber(lastValue)}</strong>
          {aggregateMode === "sum" ? (
            <>
              {" "}· total: <strong style={{ color: "#fff" }}>{formatNumber(totalSum)}</strong>
            </>
          ) : (
            <>
              {" "}· avg: <strong style={{ color: "#fff" }}>{Math.round(avg).toLocaleString("es-AR")}</strong>
              {" "}· peak: <strong style={{ color: "#fff" }}>{formatNumber(peak)}</strong>
            </>
          )}
          {" "}· trend: <strong style={{ color: trendColor }}>{trend}</strong>
        </span>
        <span>{days[days.length - 1]}</span>
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

const cohortTable: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  color: "#fff8",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  fontSize: 10,
  fontWeight: 700,
  borderBottom: "1px solid rgba(255,255,255,.12)",
};

const td: React.CSSProperties = {
  padding: "10px",
  verticalAlign: "middle",
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
