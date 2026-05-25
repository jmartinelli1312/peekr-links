"use client";

import { useCallback, useEffect, useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

interface Props {
  supabase: SupabaseClient;
}

type FunnelRow = {
  installs_7d: number;
  signups_7d: number;
  followed_7d: number;
  rated_7d: number;
  returned_after_onboarding_7d: number;
};

type DauPoint = { day: string; dau: number };

type RatingBucket = { bucket: string; users: number; ratings: number };

type CountryRow = {
  country_code: string | null;
  signups_7d: number;
  ios: number;
  android: number;
  unknown: number;
};

type EventRow = { event: string; n: number; uniq: number };

const TRACKED_EXPECTED = new Set<string>([
  "Application Installed",
  "Application Opened",
  "app_opened",
  "onboarding_step_completed",
  "first_follow",
  "title_rated",
  "share_initiated",
  "signup_completed",
  "comment_posted",
  "watchlist_added",
  "follow_user",
  "screen_viewed",
  "review_prompt_shown",
  "review_prompt_completed",
  "immersive_feed_opened",
  "immersive_feed_session",
  "immersive_feed_detail_tap",
]);

async function postAnalytics(token: string, kind: string) {
  const r = await fetch("/api/admin/analytics", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`PostHog query "${kind}" failed: ${r.status} ${text}`);
  }
  return r.json();
}

export default function AnalyticsTab({ supabase }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [funnel, setFunnel] = useState<FunnelRow | null>(null);
  const [dau, setDau] = useState<DauPoint[]>([]);
  const [buckets, setBuckets] = useState<RatingBucket[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sin sesión — re-loguéate como admin.");

      // ── Supabase funnel + buckets + country ────────────────────────────
      const [funnelRes, bucketRes, countryRes] = await Promise.all([
        supabase.rpc("admin_funnel_7d").select(),
        supabase.rpc("admin_rating_timing_14d").select(),
        supabase.rpc("admin_country_signups_7d").select(),
      ]);

      // Fallback: if the RPCs don't exist yet, run the queries inline.
      let funnelData: FunnelRow | null = null;
      if (funnelRes.error) {
        const inline = await runFunnelInline(supabase);
        funnelData = inline;
      } else if (Array.isArray(funnelRes.data) && funnelRes.data.length) {
        funnelData = funnelRes.data[0] as FunnelRow;
      }

      let bucketData: RatingBucket[] = [];
      if (bucketRes.error) {
        bucketData = await runBucketsInline(supabase);
      } else {
        bucketData = (bucketRes.data ?? []) as RatingBucket[];
      }

      let countryData: CountryRow[] = [];
      if (countryRes.error) {
        countryData = await runCountriesInline(supabase);
      } else {
        countryData = (countryRes.data ?? []) as CountryRow[];
      }

      setFunnel(funnelData);
      setBuckets(bucketData);
      setCountries(countryData);

      // ── PostHog DAU + events summary ───────────────────────────────────
      const [dauRes, evRes] = await Promise.all([
        postAnalytics(token, "dau_14d"),
        postAnalytics(token, "events_summary"),
      ]);

      setDau(
        (dauRes.results ?? []).map((row: [string, number]) => ({
          day: row[0],
          dau: row[1],
        })),
      );

      setEvents(
        (evRes.results ?? []).map((row: [string, number, number]) => ({
          event: row[0],
          n: row[1],
          uniq: row[2],
        })),
      );

      setLastUpdated(new Date().toLocaleString("es-AR"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const missingEvents = [...TRACKED_EXPECTED].filter(
    (ev) => !events.some((e) => e.event === ev),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 22 }}>📊 Analytics</h2>
          <p style={{ color: "#888", margin: "4px 0 0", fontSize: 13 }}>
            Funnel · Retención · DAU · Cobertura de tracking
            {lastUpdated && ` · actualizado ${lastUpdated}`}
          </p>
        </div>
        <button onClick={load} disabled={loading} style={btnPrimary}>
          {loading ? "Cargando..." : "↻ Refrescar"}
        </button>
      </div>

      {err && (
        <div style={errBox}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {/* ── Funnel 7d ───────────────────────────────────────────────── */}
      <Card title="Funnel últimos 7 días">
        {funnel ? (
          <Funnel funnel={funnel} />
        ) : (
          <Skeleton h={140} />
        )}
      </Card>

      {/* ── DAU trend ──────────────────────────────────────────────── */}
      <Card title="DAU últimos 14 días (PostHog)">
        {dau.length ? <DauChart points={dau} /> : <Skeleton h={140} />}
      </Card>

      {/* ── Retention buckets ──────────────────────────────────────── */}
      <Card title="¿Cuándo ratean los usuarios? (cohorte 14 días)">
        {buckets.length ? <Buckets rows={buckets} /> : <Skeleton h={140} />}
      </Card>

      {/* ── Countries ──────────────────────────────────────────────── */}
      <Card title="Signups por país (últimos 7 días)">
        {countries.length ? <CountriesTable rows={countries} /> : <Skeleton h={140} />}
      </Card>

      {/* ── Event coverage ─────────────────────────────────────────── */}
      <Card title="Cobertura de tracking (PostHog últimos 7 días)">
        {events.length ? (
          <>
            <EventsTable rows={events} />
            {missingEvents.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: "#f87171", fontWeight: 600, marginBottom: 6 }}>
                  ⚠ Eventos esperados que no están llegando:
                </div>
                <ul style={{ color: "#fca5a5", fontSize: 13, margin: 0, paddingLeft: 18 }}>
                  {missingEvents.map((ev) => (
                    <li key={ev}>{ev}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <Skeleton h={140} />
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Supabase fallbacks (used when admin_* RPCs don't exist yet)
// ─────────────────────────────────────────────────────────────────────────────

async function runFunnelInline(s: SupabaseClient): Promise<FunnelRow> {
  // Counts the actual outcomes we care about, from profiles + activities + follows.
  // Installs come from PostHog (different source), so we leave it as 0 here and
  // let the PostHog query fill that bucket if needed; the dashboard already
  // shows signups as the primary entry point.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await s
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  const signups = count ?? 0;

  const { data: pData } = await s
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", since);
  const ids = (pData ?? []).map((p) => p.id);

  let followed = 0;
  let rated = 0;
  let returned = 0;
  if (ids.length) {
    const { data: fData } = await s
      .from("follows")
      .select("user_id")
      .in("user_id", ids);
    followed = new Set((fData ?? []).map((r) => r.user_id)).size;

    const { data: aData } = await s
      .from("user_title_activities")
      .select("user_id, watched_at")
      .in("user_id", ids)
      .not("rating", "is", null);
    const byUser = new Map<string, Date[]>();
    for (const row of aData ?? []) {
      const arr = byUser.get(row.user_id) ?? [];
      arr.push(new Date(row.watched_at));
      byUser.set(row.user_id, arr);
    }
    rated = byUser.size;

    const profileMap = new Map<string, Date>(
      (pData ?? []).map((p) => [p.id, new Date(p.created_at)]),
    );
    for (const [uid, dates] of byUser) {
      const signupAt = profileMap.get(uid);
      if (!signupAt) continue;
      const hasLater = dates.some(
        (d) => d.getTime() - signupAt.getTime() > 60 * 60 * 1000,
      );
      if (hasLater) returned++;
    }
  }

  return {
    installs_7d: 0,
    signups_7d: signups,
    followed_7d: followed,
    rated_7d: rated,
    returned_after_onboarding_7d: returned,
  };
}

async function runBucketsInline(s: SupabaseClient): Promise<RatingBucket[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pData } = await s
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", since);
  const ids = (pData ?? []).map((p) => p.id);
  if (!ids.length) return [];

  const { data: aData } = await s
    .from("user_title_activities")
    .select("user_id, watched_at")
    .in("user_id", ids)
    .not("rating", "is", null);

  const profileMap = new Map<string, number>(
    (pData ?? []).map((p) => [p.id, new Date(p.created_at).getTime()]),
  );

  const counts = new Map<string, { users: Set<string>; n: number }>();
  for (const row of aData ?? []) {
    const signup = profileMap.get(row.user_id);
    if (!signup) continue;
    const deltaMs = new Date(row.watched_at).getTime() - signup;
    const min = deltaMs / 60_000;
    const hr = min / 60;
    const day = hr / 24;
    let bucket: string;
    if (min < 5) bucket = "a) onboarding (0-5 min)";
    else if (hr < 1) bucket = "b) primera sesión (5min-1h)";
    else if (day < 1) bucket = "c) mismo día (1-24h)";
    else if (day < 7) bucket = "d) día 2-7";
    else bucket = "e) día 8+";
    const entry = counts.get(bucket) ?? { users: new Set(), n: 0 };
    entry.users.add(row.user_id);
    entry.n++;
    counts.set(bucket, entry);
  }

  return [...counts.entries()]
    .map(([bucket, v]) => ({ bucket, users: v.users.size, ratings: v.n }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

async function runCountriesInline(s: SupabaseClient): Promise<CountryRow[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await s
    .from("profiles")
    .select("country_code, platform")
    .gte("created_at", since);

  const map = new Map<string | null, CountryRow>();
  for (const row of (data ?? []) as Array<{
    country_code: string | null;
    platform: string | null;
  }>) {
    const k = row.country_code;
    const entry = map.get(k) ?? {
      country_code: k,
      signups_7d: 0,
      ios: 0,
      android: 0,
      unknown: 0,
    };
    entry.signups_7d++;
    if (row.platform === "ios") entry.ios++;
    else if (row.platform === "android") entry.android++;
    else entry.unknown++;
    map.set(k, entry);
  }

  return [...map.values()].sort((a, b) => b.signups_7d - a.signups_7d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <h3 style={{ color: "#fff", margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}

function Funnel({ funnel }: { funnel: FunnelRow }) {
  const rows = [
    { label: "Installs (PostHog)", v: funnel.installs_7d },
    { label: "Signups completados", v: funnel.signups_7d },
    { label: "Siguieron a alguien", v: funnel.followed_7d },
    { label: "Ratearon ≥1 título", v: funnel.rated_7d },
    { label: "Volvieron post-onboarding", v: funnel.returned_after_onboarding_7d },
  ].filter((r) => r.v > 0 || r.label !== "Installs (PostHog)");

  const max = Math.max(...rows.map((r) => r.v), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r, i) => {
        const pct = (r.v / max) * 100;
        const prev = i > 0 ? rows[i - 1].v : r.v;
        const conv = prev ? Math.round((r.v / prev) * 100) : 100;
        return (
          <div key={r.label}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#ddd", fontSize: 13, marginBottom: 4 }}>
              <span>{r.label}</span>
              <span>
                <strong style={{ color: "#fff" }}>{r.v.toLocaleString()}</strong>
                {i > 0 && (
                  <span style={{ color: conv >= 60 ? "#34d399" : conv >= 30 ? "#fbbf24" : "#f87171", marginLeft: 8 }}>
                    {conv}%
                  </span>
                )}
              </span>
            </div>
            <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 5 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg,#FA0082,#ff80bf)",
                  borderRadius: 5,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DauChart({ points }: { points: DauPoint[] }) {
  const ordered = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const max = Math.max(...ordered.map((p) => p.dau), 1);
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 140 }}>
      {ordered.map((p) => {
        const h = (p.dau / max) * 120;
        return (
          <div key={p.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ color: "#aaa", fontSize: 10, fontWeight: 600 }}>{p.dau}</div>
            <div style={{ width: "100%", height: h, background: "linear-gradient(180deg,#FA0082,#9b1d5c)", borderRadius: 4 }} />
            <div style={{ color: "#666", fontSize: 9 }}>{p.day.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

function Buckets({ rows }: { rows: RatingBucket[] }) {
  const total = rows.reduce((s, r) => s + r.users, 0);
  return (
    <table style={tbl}>
      <thead>
        <tr><th style={th}>Cuándo</th><th style={th}>Usuarios</th><th style={th}>Ratings</th><th style={th}>%</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.bucket}>
            <td style={td}>{r.bucket}</td>
            <td style={td}>{r.users.toLocaleString()}</td>
            <td style={td}>{r.ratings.toLocaleString()}</td>
            <td style={td}>{total ? Math.round((r.users / total) * 100) : 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CountriesTable({ rows }: { rows: CountryRow[] }) {
  return (
    <table style={tbl}>
      <thead>
        <tr>
          <th style={th}>País</th>
          <th style={th}>Signups</th>
          <th style={th}>iOS</th>
          <th style={th}>Android</th>
          <th style={th}>?</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.country_code ?? "null"}>
            <td style={td}>{r.country_code ?? "(sin país)"}</td>
            <td style={td}>{r.signups_7d}</td>
            <td style={td}>{r.ios}</td>
            <td style={td}>{r.android}</td>
            <td style={{ ...td, color: "#888" }}>{r.unknown}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventsTable({ rows }: { rows: EventRow[] }) {
  return (
    <table style={tbl}>
      <thead>
        <tr>
          <th style={th}>Evento</th>
          <th style={th}>Count</th>
          <th style={th}>Usuarios únicos</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.event}>
            <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.event}</td>
            <td style={td}>{r.n.toLocaleString()}</td>
            <td style={td}>{r.uniq.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Skeleton({ h }: { h: number }) {
  return <div style={{ height: h, background: "rgba(255,255,255,0.04)", borderRadius: 8 }} />;
}

const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse" as const };
const th: React.CSSProperties = { textAlign: "left", color: "#aaa", fontSize: 12, fontWeight: 600, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" };
const td: React.CSSProperties = { color: "#ddd", fontSize: 13, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)" };
const btnPrimary: React.CSSProperties = { background: "#FA0082", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const errBox: React.CSSProperties = { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 12, padding: "12px 16px", color: "#fca5a5", fontSize: 13 };
