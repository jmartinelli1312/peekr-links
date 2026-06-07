"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  artRangeToUtcIso,
  BarList,
  BRAND,
  fmtInt,
  fmtPct,
  Lang,
  LineChart,
  Panel,
  StatCard,
  StatGrid,
} from "./_shared";
import { dashTexts, sectionLabel } from "./texts";

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
  lang,
  country,
}: {
  supabase: SupabaseClient;
  range: Range;
  onlyOnboarded: boolean;
  lang: Lang;
  country: string;
}) {
  const t = dashTexts(lang);
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
        supabase.rpc("cdash_geo", { p_from: fromTs, p_to_exclusive: toTsExclusive, p_country: country }),
        supabase.rpc("cdash_retention", { p_from: fromTs, p_to_exclusive: toTsExclusive, p_only_onboarded: onlyOnboarded, p_country: country }),
        supabase.rpc("cdash_wow_retention", { p_weeks: 8, p_country: country }),
        supabase.rpc("cdash_time_series", { p_from: fromTs, p_to_exclusive: toTsExclusive, p_only_onboarded: onlyOnboarded, p_country: country }),
        supabase.rpc("cdash_behavior", { p_from: fromTs, p_to_exclusive: toTsExclusive, p_only_onboarded: onlyOnboarded, p_country: country }),
        supabase.rpc("cdash_app_engagement", { p_from: fromTs, p_to_exclusive: toTsExclusive, p_country: country }),
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
  }, [supabase, range, onlyOnboarded, country]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  if (err) {
    return <div style={{ color: "#fca5a5", padding: 16 }}>⚠ {err}</div>;
  }
  if (loading && !geo) {
    return <div style={{ color: "rgba(255,255,255,0.5)", padding: 24 }}>{t.loadingMetrics}</div>;
  }

  return (
    <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
      {/* Global data del país (totales acumulados) */}
      {geo && (
        <Panel title={t.globalTitle} subtitle={t.globalSub}>
          <StatGrid>
            <StatCard label={t.totalUsers} value={fmtInt(geo.totals.users)} />
            <StatCard label={t.onboardingDone} value={fmtInt(geo.totals.onboarded)} />
            <StatCard label={t.totalRatings} value={fmtInt(geo.totals.ratings)} />
            <StatCard label={t.inWatchlist} value={fmtInt(geo.totals.watchlist)} />
          </StatGrid>
        </Panel>
      )}

      {/* Audiencia (installs) + onboarding del período */}
      {geo && (
        <Panel title={t.audienceTitle} subtitle={t.audienceSub}>
          <StatGrid>
            <StatCard label={t.newInstalls} value={fmtInt(geo.new_signups)} hint={t.prevPeriod(fmtInt(geo.new_signups_prev))} accent={BRAND} />
            <StatCard label={t.onboardingDone} value={fmtInt(geo.onboarding_completed)} />
            <StatCard label={t.onboardingRate} value={fmtPct(geo.onboarding_rate)} />
          </StatGrid>
        </Panel>
      )}

      {/* Crecimiento de audiencia */}
      {geo && geo.growth_chart.length > 0 && (
        <Panel title={t.growthTitle} subtitle={t.growthSub}>
          <LineChart
            values={geo.growth_chart.map((g) => g.cumulative)}
            labels={geo.growth_chart.map((g) => g.day)}
          />
        </Panel>
      )}

      {/* Platform + Provider */}
      {geo && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <Panel title={t.platformTitle} subtitle={t.platformSub}>
            <BarList data={geo.by_platform} emptyLabel={t.noData} />
          </Panel>
          <Panel title={t.providerTitle} subtitle={t.providerSub}>
            <BarList data={geo.by_provider} color="#6366f1" emptyLabel={t.noData} />
          </Panel>
        </div>
      )}

      {/* Retención DAU/WAU/MAU */}
      {ret && (
        <Panel title={t.retentionTitle} subtitle={t.retentionSub(String(ret.days_in_period ?? "—"), ret.days_in_period !== 1)}>
          <StatGrid>
            <StatCard label={t.dauAvg} value={`${ret.dau}`} hint={ret.contributors_dau != null ? t.contrib(ret.contributors_dau) : undefined} accent={BRAND} />
            <StatCard label={t.wauAvg} value={`${ret.wau}`} hint={ret.contributors_wau != null ? t.contrib(ret.contributors_wau) : undefined} />
            <StatCard label={t.mauAvg} value={`${ret.mau}`} hint={ret.contributors_mau != null ? t.contrib(ret.contributors_mau) : undefined} />
            <StatCard label={t.northStarAvg} value={ret.north_star != null ? `${ret.north_star}` : "—"} hint={t.weuHint} accent={BRAND} />
            <StatCard label={t.dauMau} value={fmtPct(ret.stickiness_dau_mau)} hint={t.stickyDaily} />
            <StatCard label={t.wauMau} value={fmtPct(ret.stickiness_wau_mau)} hint={t.stickyWeekly} />
            <StatCard label={t.churnRisk} value={fmtInt(ret.churn_risk)} />
            <StatCard label={t.resurrected} value={fmtInt(ret.resurrected)} />
            <StatCard label={t.firstTimeActive} value={fmtInt(ret.first_time_active)} hint={t.thisWeek} />
          </StatGrid>
        </Panel>
      )}

      {/* Retención WoW */}
      {wow && wow.base_weeks.length > 0 && (
        <Panel title={t.wowTitle} subtitle={t.wowSub}>
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
        <Panel title={t.dailyDauTitle} subtitle={t.dailyDauSub}>
          <LineChart values={ts.retention.dau} labels={ts.days} color="#10b981" />
        </Panel>
      )}

      {beh && (
        <Panel title={t.behaviorTitle} subtitle={t.behaviorSub(fmtInt(beh.active_users))}>
          <StatGrid>
            <StatCard label={t.ratings} value={fmtInt(beh.ratings.total)} hint={t.perActive(beh.ratings.per_active_avg)} />
            <StatCard label={t.comments} value={fmtInt(beh.comments.total)} hint={t.perActive(beh.comments.per_active_avg)} />
            <StatCard label={t.watchlist} value={fmtInt(beh.watchlist.total)} hint={t.perActive(beh.watchlist.per_active_avg)} />
            <StatCard label={t.peeklistsCreated} value={fmtInt(beh.peeklists.created)} hint={t.items(fmtInt(beh.peeklists.items_added))} />
            <StatCard label={t.likesTitles} value={fmtInt(beh.likes.title_likes)} />
            <StatCard label={t.likesComments} value={fmtInt(beh.likes.comment_likes_given)} />
            <StatCard label={t.follows} value={fmtInt(beh.follows.created)} hint={t.mutual(fmtPct(beh.follows.mutual_pct))} />
            <StatCard label={t.ratersReturning} value={fmtInt(beh.north_star_war_returning)} hint={t.ratersHint} />
          </StatGrid>
        </Panel>
      )}

      {/* Uso de la app: tiempo + secciones */}
      {app && (
        <Panel title={t.appTitle} subtitle={t.appSub}>
          <StatGrid>
            <StatCard label={t.timePerUser} value={`${app.avg_min_per_user} ${t.minShort}`} hint={t.median(app.median_min_per_user)} accent={BRAND} />
            <StatCard label={t.totalTime} value={`${Math.round(app.total_minutes / 60)} h`} hint={`${fmtInt(app.total_minutes)} ${t.minShort}`} />
            <StatCard label={t.perScreen} value={`${app.avg_sec_per_screen}s`} />
            <StatCard label={t.usersWithNav} value={fmtInt(app.active_users)} />
          </StatGrid>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{t.mostNavigated}</div>
            {(() => {
              const sections = (app.top_sections ?? []).filter((s) => !ONBOARDING_SCREENS.has(s.screen));
              const maxViews = sections.reduce((m, s) => Math.max(m, s.views), 0) || 1;
              if (sections.length === 0) return <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{t.noData}</div>;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sections.map((s) => (
                    <div key={s.screen} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 140, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{sectionLabel(s.screen, t)}</div>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 20 }}>
                        <div style={{ width: `${(s.views / maxViews) * 100}%`, background: BRAND, height: "100%", borderRadius: 6, minWidth: 2 }} />
                      </div>
                      <div style={{ width: 170, textAlign: "right", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        {fmtInt(s.views)} · {fmtInt(s.users)} · {s.avg_sec}s
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
