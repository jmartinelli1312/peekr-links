"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  artRangeToUtcIso,
  BarList,
  BRAND,
  fmtInt,
  fmtPct,
  LineChart,
  Panel,
  StatCard,
  StatGrid,
} from "./_shared";

type Range = { from: string; to: string };

type Geo = {
  new_signups: number;
  new_signups_prev: number;
  onboarding_completed: number;
  onboarding_rate: number;
  by_platform: Record<string, number>;
  by_provider: Record<string, number>;
  growth_chart: Array<{ day: string; signups: number; cumulative: number }>;
  totals: { users: number; onboarded: number; ratings: number; watchlist: number };
};

type Retention = {
  dau: number;
  wau: number;
  mau: number;
  stickiness_dau_mau: number;
  stickiness_wau_mau: number;
  contributors_dau?: number;
  contributors_wau?: number;
  contributors_mau?: number;
  north_star?: number;
  days_in_period?: number;
  churn_risk: number;
  resurrected: number;
  first_time_active: number;
};

type Wow = {
  base_weeks: string[];
  base_active: number[];
  retained: number[];
  retention_pct: number[];
};

type TimeSeries = {
  days: string[];
  retention: { dau: number[]; signups: number[]; first_time_active: number[] };
};

type AppSection = { screen: string; views: number; users: number; total_min: number; avg_sec: number };
type AppEngagement = {
  active_users: number;
  total_minutes: number;
  avg_min_per_user: number;
  median_min_per_user: number;
  avg_sec_per_screen: number;
  top_sections: AppSection[];
};

const ONBOARDING_SCREENS = new Set([
  "/intro-carousel", "/post-signup", "/auth-landing", "/login-callback",
  "/follow-onboarding-seen", "/onboarding", "/signup", "/guest-lock",
]);
const SECTION_LABELS: Record<string, string> = {
  "/title/:type/:id": "Ficha de título", "/detail": "Detalle de título", "/actor/:id": "Actor",
  "/u/:username": "Perfil de usuario", "/profile/peeklists/:id": "Peeklist", "/watchlist": "Watchlist",
  "/follow-list": "Seguidores / Siguiendo", "/inbox/chat/:id": "Chat", "/inbox/new": "Nuevo chat",
  "/settings": "Ajustes", "/settings/about": "Acerca de", "/edit-profile": "Editar perfil",
};

type Behavior = {
  active_users: number;
  ratings: { total: number; per_active_avg: number };
  comments: { total: number; per_active_avg: number };
  watchlist: { total: number; per_active_avg: number };
  peeklists: { created: number; items_added: number };
  likes: { comment_likes_given: number; comment_likes_received: number; title_likes: number };
  follows: { created: number; mutual: number; mutual_pct: number };
  north_star_war_returning: number;
};

export default function CountryMetricsTab({
  supabase,
  range,
  onlyOnboarded,
}: {
  supabase: SupabaseClient;
  range: Range;
  onlyOnboarded: boolean;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [ret, setRet] = useState<Retention | null>(null);
  const [wow, setWow] = useState<Wow | null>(null);
  const [ts, setTs] = useState<TimeSeries | null>(null);
  const [beh, setBeh] = useState<Behavior | null>(null);
  const [app, setApp] = useState<AppEngagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { fromTs, toTsExclusive } = artRangeToUtcIso(range);
      const [geoRes, retRes, wowRes, tsRes, behRes, appRes] = await Promise.all([
        supabase.rpc("creator_kpi_geo", { p_from: fromTs, p_to_exclusive: toTsExclusive }),
        supabase.rpc("creator_kpi_retention", { p_from: fromTs, p_to_exclusive: toTsExclusive, p_only_onboarded: onlyOnboarded }),
        supabase.rpc("creator_kpi_wow_retention", { p_weeks: 8 }),
        supabase.rpc("creator_kpi_time_series", { p_from: fromTs, p_to_exclusive: toTsExclusive, p_only_onboarded: onlyOnboarded }),
        supabase.rpc("creator_kpi_behavior", { p_from: fromTs, p_to_exclusive: toTsExclusive, p_only_onboarded: onlyOnboarded }),
        supabase.rpc("creator_kpi_app_engagement", { p_from: fromTs, p_to_exclusive: toTsExclusive }),
      ]);
      if (geoRes.error) throw geoRes.error;
      if (retRes.error) throw retRes.error;
      if (wowRes.error) throw wowRes.error;
      if (tsRes.error) throw tsRes.error;
      if (behRes.error) throw behRes.error;
      if (appRes.error) throw appRes.error;
      setGeo(geoRes.data as Geo);
      setRet(retRes.data as Retention);
      setWow(wowRes.data as Wow);
      setTs(tsRes.data as TimeSeries);
      setBeh(behRes.data as Behavior);
      setApp(appRes.data as AppEngagement);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase, range, onlyOnboarded]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  if (err) {
    return <div style={{ color: "#fca5a5", padding: 16 }}>⚠ {err}</div>;
  }
  if (loading && !geo) {
    return <div style={{ color: "rgba(255,255,255,0.5)", padding: 24 }}>Cargando métricas…</div>;
  }

  return (
    <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
      {/* Global data del país (totales acumulados) */}
      {geo && (
        <Panel title="Global del país" subtitle="Totales acumulados (toda la historia)">
          <StatGrid>
            <StatCard label="Usuarios totales" value={fmtInt(geo.totals.users)} />
            <StatCard label="Onboarding completo" value={fmtInt(geo.totals.onboarded)} />
            <StatCard label="Ratings totales" value={fmtInt(geo.totals.ratings)} />
            <StatCard label="En watchlist" value={fmtInt(geo.totals.watchlist)} />
          </StatGrid>
        </Panel>
      )}

      {/* Audiencia (installs) + onboarding del período */}
      {geo && (
        <Panel title="Audiencia del período" subtitle="Installs y onboarding en el rango seleccionado">
          <StatGrid>
            <StatCard label="Nuevos installs" value={fmtInt(geo.new_signups)} hint={`Período previo: ${fmtInt(geo.new_signups_prev)}`} accent={BRAND} />
            <StatCard label="Onboarding completo" value={fmtInt(geo.onboarding_completed)} />
            <StatCard label="Tasa de onboarding" value={fmtPct(geo.onboarding_rate)} />
          </StatGrid>
        </Panel>
      )}

      {/* Crecimiento de audiencia */}
      {geo && geo.growth_chart.length > 0 && (
        <Panel title="Crecimiento de audiencia" subtitle="Usuarios acumulados del país en el período">
          <LineChart
            values={geo.growth_chart.map((g) => g.cumulative)}
            labels={geo.growth_chart.map((g) => g.day)}
          />
        </Panel>
      )}

      {/* Platform + Provider */}
      {geo && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <Panel title="Platform" subtitle="Nuevos installs por plataforma">
            <BarList data={geo.by_platform} />
          </Panel>
          <Panel title="Provider" subtitle="Método de registro (Google / Apple / email)">
            <BarList data={geo.by_provider} color="#6366f1" />
          </Panel>
        </div>
      )}

      {/* Retención DAU/WAU/MAU */}
      {ret && (
        <Panel title="Retención" subtitle={`Promedio diario del período (${ret.days_in_period ?? "—"} día${ret.days_in_period === 1 ? "" : "s"}). Uso real = navegó contenido o hizo una acción. 'contrib' = solo acciones explícitas post-install.`}>
          <StatGrid>
            <StatCard label="DAU prom/día" value={`${ret.dau}`} hint={ret.contributors_dau != null ? `contrib: ${ret.contributors_dau}` : undefined} accent={BRAND} />
            <StatCard label="WAU prom/día" value={`${ret.wau}`} hint={ret.contributors_wau != null ? `contrib: ${ret.contributors_wau}` : undefined} />
            <StatCard label="MAU prom/día" value={`${ret.mau}`} hint={ret.contributors_mau != null ? `contrib: ${ret.contributors_mau}` : undefined} />
            <StatCard label="North Star prom/día" value={ret.north_star != null ? `${ret.north_star}` : "—"} hint="WEU (cuentas ≥7d)" accent={BRAND} />
            <StatCard label="DAU / MAU" value={fmtPct(ret.stickiness_dau_mau)} hint="Stickiness diario" />
            <StatCard label="WAU / MAU" value={fmtPct(ret.stickiness_wau_mau)} hint="Stickiness semanal" />
            <StatCard label="En riesgo de churn" value={fmtInt(ret.churn_risk)} />
            <StatCard label="Resucitados" value={fmtInt(ret.resurrected)} />
            <StatCard label="Activos por 1ª vez" value={fmtInt(ret.first_time_active)} hint="Esta semana" />
          </StatGrid>
        </Panel>
      )}

      {/* Retención WoW */}
      {wow && wow.base_weeks.length > 0 && (
        <Panel title="Retención semana a semana (WoW)" subtitle="% de activos de una semana que vuelven la siguiente">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wow.base_weeks.map((week, i) => (
              <div key={week} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 90, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{week}</div>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 20 }}>
                  <div style={{ width: `${Math.min(wow.retention_pct[i], 100)}%`, background: "#10b981", height: "100%", borderRadius: 6, minWidth: 2 }} />
                </div>
                <div style={{ width: 110, textAlign: "right", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                  {fmtPct(wow.retention_pct[i])} · {fmtInt(wow.retained[i])}/{fmtInt(wow.base_active[i])}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Comportamiento (DAU activity series + behavior totals) */}
      {ts && ts.days.length > 0 && (
        <Panel title="Actividad diaria (DAU)" subtitle="Usuarios activos por día en el período">
          <LineChart values={ts.retention.dau} labels={ts.days} color="#10b981" />
        </Panel>
      )}

      {beh && (
        <Panel title="Comportamiento" subtitle={`Usuarios activos en el período: ${fmtInt(beh.active_users)}`}>
          <StatGrid>
            <StatCard label="Ratings" value={fmtInt(beh.ratings.total)} hint={`${beh.ratings.per_active_avg} por activo`} />
            <StatCard label="Comentarios" value={fmtInt(beh.comments.total)} hint={`${beh.comments.per_active_avg} por activo`} />
            <StatCard label="Watchlist" value={fmtInt(beh.watchlist.total)} hint={`${beh.watchlist.per_active_avg} por activo`} />
            <StatCard label="Peeklists creadas" value={fmtInt(beh.peeklists.created)} hint={`${fmtInt(beh.peeklists.items_added)} ítems`} />
            <StatCard label="Likes (títulos)" value={fmtInt(beh.likes.title_likes)} />
            <StatCard label="Likes (comentarios)" value={fmtInt(beh.likes.comment_likes_given)} />
            <StatCard label="Follows" value={fmtInt(beh.follows.created)} hint={`${fmtPct(beh.follows.mutual_pct)} mutuos`} />
            <StatCard label="Rateadores retornando" value={fmtInt(beh.north_star_war_returning)} hint="Cuentas ≥7d que ratearon (7d)" />
          </StatGrid>
        </Panel>
      )}

      {/* Uso de la app: tiempo + secciones */}
      {app && (
        <Panel title="Uso de la app" subtitle="Tiempo en app y secciones más navegadas (screen_views desde 29-may, duración capada a 10 min/pantalla)">
          <StatGrid>
            <StatCard label="Tiempo / usuario" value={`${app.avg_min_per_user} min`} hint={`Mediana: ${app.median_min_per_user} min`} accent={BRAND} />
            <StatCard label="Tiempo total" value={`${Math.round(app.total_minutes / 60)} h`} hint={`${fmtInt(app.total_minutes)} min`} />
            <StatCard label="Por pantalla" value={`${app.avg_sec_per_screen}s`} />
            <StatCard label="Usuarios con navegación" value={fmtInt(app.active_users)} />
          </StatGrid>
          <div style={{ marginTop: 16 }}>
            {(() => {
              const sections = (app.top_sections ?? []).filter((s) => !ONBOARDING_SCREENS.has(s.screen));
              const maxViews = sections.reduce((m, s) => Math.max(m, s.views), 0) || 1;
              if (sections.length === 0) return <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Sin datos</div>;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sections.map((s) => (
                    <div key={s.screen} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 140, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{SECTION_LABELS[s.screen] ?? s.screen}</div>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 20 }}>
                        <div style={{ width: `${(s.views / maxViews) * 100}%`, background: BRAND, height: "100%", borderRadius: 6, minWidth: 2 }} />
                      </div>
                      <div style={{ width: 170, textAlign: "right", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        {fmtInt(s.views)} vistas · {fmtInt(s.users)} users · {s.avg_sec}s
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </Panel>
      )}
    </div>
  );
}
