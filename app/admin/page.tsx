   "use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminState = "loading" | "authorized" | "unauthorized";

type DashboardMetrics = {
  totalUsers: number;
  newUsersToday: number;
  newUsers7d: number;
  newUsers30d: number;
  dau: number;
  wau: number;
  mau: number;
  totalRatings: number;
  ratingsToday: number;
  ratings7d: number;
  ratings30d: number;
  watchlistToday: number;
  watchlist7d: number;
  watchlist30d: number;
  totalPeeklists: number;
  publishedBuzz: number;
  onboardingCompleted: number;
};

type RecentUser = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  created_at?: string | null;
};

type RecentRating = {
  id: number;
  user_id: string;
  tmdb_id: number;
  rating: number;
  created_at?: string | null;
};

type RecentBuzz = {
  id: number;
  title: string;
  source_name?: string | null;
  category?: string | null;
  published_at?: string | null;
};

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function AdminPage() {
  const router = useRouter();
  const [state, setState] = useState<AdminState>("loading");
  const [email, setEmail] = useState<string>("");
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalUsers: 0,
    newUsersToday: 0,
    newUsers7d: 0,
    newUsers30d: 0,
    dau: 0,
    wau: 0,
    mau: 0,
    totalRatings: 0,
    ratingsToday: 0,
    ratings7d: 0,
    ratings30d: 0,
    watchlistToday: 0,
    watchlist7d: 0,
    watchlist30d: 0,
    totalPeeklists: 0,
    publishedBuzz: 0,
    onboardingCompleted: 0,
  });

  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([]);
  const [recentBuzz, setRecentBuzz] = useState<RecentBuzz[]>([]);

  const onboardingRate = useMemo(() => {
    if (!metrics.totalUsers) return 0;
    return (metrics.onboardingCompleted / metrics.totalUsers) * 100;
  }, [metrics.onboardingCompleted, metrics.totalUsers]);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoadingData(true);
        setError("");

        const todayIso = startOfTodayIso();
        const sevenIso = daysAgoIso(7);
        const thirtyIso = daysAgoIso(30);

        const [
          authRes,
          totalUsersRes,
          newUsersTodayRes,
          newUsers7dRes,
          newUsers30dRes,
          onboardingCompletedRes,

          totalRatingsRes,
          ratingsTodayRes,
          ratings7dRes,
          ratings30dRes,

          watchlistTodayRes,
          watchlist7dRes,
          watchlist30dRes,

          totalPeeklistsRes,
          publishedBuzzRes,

          activityFeed30dRes,

          recentUsersRes,
          recentRatingsRes,
          recentBuzzRes,
        ] = await Promise.all([
          supabase.auth.getUser(),

          supabase.from("profiles").select("*", { count: "exact", head: true }),

          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .gte("created_at", todayIso),

          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .gte("created_at", sevenIso),

          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .gte("created_at", thirtyIso),

          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("has_completed_onboarding", true),

          supabase.from("ratings").select("*", { count: "exact", head: true }),

          supabase
            .from("ratings")
            .select("*", { count: "exact", head: true })
            .gte("created_at", todayIso),

          supabase
            .from("ratings")
            .select("*", { count: "exact", head: true })
            .gte("created_at", sevenIso),

          supabase
            .from("ratings")
            .select("*", { count: "exact", head: true })
            .gte("created_at", thirtyIso),

          supabase
            .from("watchlist")
            .select("*", { count: "exact", head: true })
            .gte("created_at", todayIso),

          supabase
            .from("watchlist")
            .select("*", { count: "exact", head: true })
            .gte("created_at", sevenIso),

          supabase
            .from("watchlist")
            .select("*", { count: "exact", head: true })
            .gte("created_at", thirtyIso),

          supabase.from("peeklists").select("*", { count: "exact", head: true }),

          supabase
            .from("peekrbuzz_articles")
            .select("*", { count: "exact", head: true })
            .eq("is_published", true),

         supabase
           .from("activity_feed")
           .select("actor_id, created_at")
           .gte("created_at", thirtyIso),

          supabase
            .from("profiles")
            .select("id, username, display_name, created_at")
            .order("created_at", { ascending: false })
            .limit(8),

          supabase
            .from("ratings")
            .select("id, user_id, tmdb_id, rating, created_at")
            .order("created_at", { ascending: false })
            .limit(8),

          supabase
            .from("peekrbuzz_articles")
            .select("id, title, source_name, category, published_at")
            .eq("is_published", true)
            .order("published_at", { ascending: false })
            .limit(8),
        ]);

        const {
          data: { user },
          error: userError,
        } = authRes;

        if (!mounted) return;

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        setEmail(user.email ?? "");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError || !profile?.is_admin) {
          setState("unauthorized");
          router.replace("/");
          return;
        }

      const activityRows =
        (activityFeed30dRes.data as Array<{
          actor_id: string;
          created_at?: string | null;
        }> | null) ?? [];

        const dauSet = new Set<string>();
        const wauSet = new Set<string>();
        const mauSet = new Set<string>();

        const now = Date.now();
        const oneDayMs = 1 * 24 * 60 * 60 * 1000;
        const sevenDayMs = 7 * 24 * 60 * 60 * 1000;
        const thirtyDayMs = 30 * 24 * 60 * 60 * 1000;

       for (const row of activityRows) {
        if (!row.actor_id || !row.created_at) continue;
        const ts = new Date(row.created_at).getTime();
        const diff = now - ts;
      
        if (diff <= oneDayMs) dauSet.add(row.actor_id);
        if (diff <= sevenDayMs) wauSet.add(row.actor_id);
        if (diff <= thirtyDayMs) mauSet.add(row.actor_id);
      }

        setMetrics({
          totalUsers: totalUsersRes.count ?? 0,
          newUsersToday: newUsersTodayRes.count ?? 0,
          newUsers7d: newUsers7dRes.count ?? 0,
          newUsers30d: newUsers30dRes.count ?? 0,
          dau: dauSet.size,
          wau: wauSet.size,
          mau: mauSet.size,
          totalRatings: totalRatingsRes.count ?? 0,
          ratingsToday: ratingsTodayRes.count ?? 0,
          ratings7d: ratings7dRes.count ?? 0,
          ratings30d: ratings30dRes.count ?? 0,
          watchlistToday: watchlistTodayRes.count ?? 0,
          watchlist7d: watchlist7dRes.count ?? 0,
          watchlist30d: watchlist30dRes.count ?? 0,
          totalPeeklists: totalPeeklistsRes.count ?? 0,
          publishedBuzz: publishedBuzzRes.count ?? 0,
          onboardingCompleted: onboardingCompletedRes.count ?? 0,
        });

        setRecentUsers((recentUsersRes.data as RecentUser[] | null) ?? []);
        setRecentRatings((recentRatingsRes.data as RecentRating[] | null) ?? []);
        setRecentBuzz((recentBuzzRes.data as RecentBuzz[] | null) ?? []);

        setState("authorized");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Error loading admin");
        setState("authorized");
      } finally {
        if (mounted) setLoadingData(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          background: "#0b0b0f",
          padding: 24,
        }}
      >
        <div>Validando acceso...</div>
      </main>
    );
  }

  if (state !== "authorized") {
    return null;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        color: "white",
        background: "#0b0b0f",
        padding: 24,
      }}
    >
      <style>{`
        .admin-shell {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .admin-top h1 {
          margin: 0;
          font-size: clamp(34px, 6vw, 52px);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .admin-top p {
          margin: 10px 0 0 0;
          color: rgba(255,255,255,0.72);
          font-size: 15px;
        }

        .grid-cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 18px;
        }

        .card-label {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          font-weight: 700;
        }

        .card-value {
          margin-top: 8px;
          font-size: clamp(24px, 4vw, 34px);
          line-height: 1;
          font-weight: 900;
          color: white;
        }

        .card-sub {
          margin-top: 8px;
          font-size: 13px;
          color: rgba(255,255,255,0.65);
        }

        .section {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .section h2 {
          margin: 0;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .section-note {
          color: rgba(255,255,255,0.64);
          font-size: 14px;
          margin-top: -4px;
        }

        .three-col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .mini-metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .mini-metric:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .mini-name {
          color: rgba(255,255,255,0.72);
          font-size: 14px;
          font-weight: 700;
        }

        .mini-value {
          font-size: 18px;
          font-weight: 900;
        }

        .tables {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .table-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 18px;
        }

        .table-card h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 900;
        }

        .row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .row-left {
          min-width: 0;
        }

        .row-title {
          font-size: 14px;
          font-weight: 700;
          color: white;
          line-height: 1.4;
        }

        .row-sub {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255,255,255,0.58);
        }

        .row-right {
          flex-shrink: 0;
          font-size: 13px;
          color: rgba(255,255,255,0.76);
          font-weight: 700;
          text-align: right;
        }

        .warning {
          background: rgba(255, 90, 90, 0.08);
          border: 1px solid rgba(255, 90, 90, 0.25);
          color: #ffb3b3;
          border-radius: 16px;
          padding: 14px 16px;
        }

        @media (min-width: 900px) {
          .grid-cards {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .three-col {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .tables {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="admin-shell">
        <section className="admin-top">
          <h1>Admin Dashboard</h1>
          <p>Acceso autorizado · {email}</p>
        </section>

        {error ? <div className="warning">{error}</div> : null}

        {loadingData ? (
          <div className="card">Cargando métricas...</div>
        ) : (
          <>
            <section className="grid-cards">
              <div className="card">
                <div className="card-label">Total users</div>
                <div className="card-value">{formatNumber(metrics.totalUsers)}</div>
                <div className="card-sub">
                  Onboarding: {formatNumber(metrics.onboardingCompleted)} · {formatPct(onboardingRate)}
                </div>
              </div>

              <div className="card">
                <div className="card-label">DAU</div>
                <div className="card-value">{formatNumber(metrics.dau)}</div>
                <div className="card-sub">Usuarios activos últimas 24h</div>
              </div>

              <div className="card">
                <div className="card-label">WAU</div>
                <div className="card-value">{formatNumber(metrics.wau)}</div>
                <div className="card-sub">Usuarios activos últimos 7 días</div>
              </div>

              <div className="card">
                <div className="card-label">MAU</div>
                <div className="card-value">{formatNumber(metrics.mau)}</div>
                <div className="card-sub">Usuarios activos últimos 30 días</div>
              </div>

              <div className="card">
                <div className="card-label">Total ratings</div>
                <div className="card-value">{formatNumber(metrics.totalRatings)}</div>
                <div className="card-sub">
                  Hoy {formatNumber(metrics.ratingsToday)} · 7d {formatNumber(metrics.ratings7d)}
                </div>
              </div>
            </section>

            <section className="section">
              <h2>Growth</h2>
              <div className="three-col">
                <div className="card">
                  <div className="mini-metric">
                    <div className="mini-name">New users today</div>
                    <div className="mini-value">{formatNumber(metrics.newUsersToday)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">New users 7d</div>
                    <div className="mini-value">{formatNumber(metrics.newUsers7d)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">New users 30d</div>
                    <div className="mini-value">{formatNumber(metrics.newUsers30d)}</div>
                  </div>
                </div>

                <div className="card">
                  <div className="mini-metric">
                    <div className="mini-name">Ratings today</div>
                    <div className="mini-value">{formatNumber(metrics.ratingsToday)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">Ratings 7d</div>
                    <div className="mini-value">{formatNumber(metrics.ratings7d)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">Ratings 30d</div>
                    <div className="mini-value">{formatNumber(metrics.ratings30d)}</div>
                  </div>
                </div>

                <div className="card">
                  <div className="mini-metric">
                    <div className="mini-name">Watchlist adds today</div>
                    <div className="mini-value">{formatNumber(metrics.watchlistToday)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">Watchlist adds 7d</div>
                    <div className="mini-value">{formatNumber(metrics.watchlist7d)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">Watchlist adds 30d</div>
                    <div className="mini-value">{formatNumber(metrics.watchlist30d)}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="section">
              <h2>Content</h2>
              <div className="three-col">
                <div className="card">
                  <div className="mini-metric">
                    <div className="mini-name">Total peeklists</div>
                    <div className="mini-value">{formatNumber(metrics.totalPeeklists)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">Published PeekrBuzz</div>
                    <div className="mini-value">{formatNumber(metrics.publishedBuzz)}</div>
                  </div>
                </div>

                <div className="card">
                  <div className="mini-metric">
                    <div className="mini-name">DAU / MAU</div>
                    <div className="mini-value">
                      {metrics.mau ? formatPct((metrics.dau / metrics.mau) * 100) : "0.0%"}
                    </div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">WAU / MAU</div>
                    <div className="mini-value">
                      {metrics.mau ? formatPct((metrics.wau / metrics.mau) * 100) : "0.0%"}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="mini-metric">
                    <div className="mini-name">Instrumentation pending</div>
                    <div className="mini-value">Phase 2</div>
                  </div>
                  <div className="section-note">
                    tráfico web por página, búsquedas y adquisición web/app
                  </div>
                </div>
              </div>
            </section>

            <section className="section">
              <h2>Recent activity</h2>
              <p className="section-note">Panel inicial con tablas rápidas para monitoreo manual.</p>

              <div className="tables">
                <div className="table-card">
                  <h3>Recent users</h3>
                  {recentUsers.map((item) => (
                    <div key={item.id} className="row">
                      <div className="row-left">
                        <div className="row-title">
                          {item.display_name || item.username || item.id.slice(0, 8)}
                        </div>
                        <div className="row-sub">@{item.username || "no-username"}</div>
                      </div>
                      <div className="row-right">{formatDate(item.created_at)}</div>
                    </div>
                  ))}
                </div>

                <div className="table-card">
                  <h3>Recent ratings</h3>
                  {recentRatings.map((item) => (
                    <div key={item.id} className="row">
                      <div className="row-left">
                        <div className="row-title">TMDB {item.tmdb_id}</div>
                        <div className="row-sub">user {item.user_id.slice(0, 8)}</div>
                      </div>
                      <div className="row-right">
                        ⭐ {item.rating}
                        <div className="row-sub">{formatDate(item.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="table-card">
                  <h3>Recent PeekrBuzz</h3>
                  {recentBuzz.map((item) => (
                    <div key={item.id} className="row">
                      <div className="row-left">
                        <div className="row-title">{item.title}</div>
                        <div className="row-sub">
                          {item.source_name || "—"} · {item.category || "—"}
                        </div>
                      </div>
                      <div className="row-right">{formatDate(item.published_at)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
