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
  totalEditorialCollections: number;
  publishedEditorialCollections: number;
};

type RecentUser = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  created_at?: string | null;
};

type RecentRating = {
  id: number | string;
  user_id: string;
  tmdb_id: number;
  rating: number;
  created_at?: string | null;
};

type RecentWatchlist = {
  id: number | string;
  user_id: string;
  tmdb_id: number;
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
    totalEditorialCollections: 0,
    publishedEditorialCollections: 0,
  });

  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([]);
  const [recentWatchlist, setRecentWatchlist] = useState<RecentWatchlist[]>([]);
  const [recentBuzz, setRecentBuzz] = useState<RecentBuzz[]>([]);

  const onboardingRate = useMemo(() => {
    if (!metrics.totalUsers) return 0;
    return (metrics.onboardingCompleted / metrics.totalUsers) * 100;
  }, [metrics.onboardingCompleted, metrics.totalUsers]);

  const dauRate = useMemo(() => {
    if (!metrics.totalUsers) return 0;
    return (metrics.dau / metrics.totalUsers) * 100;
  }, [metrics.dau, metrics.totalUsers]);

  const wauRate = useMemo(() => {
    if (!metrics.totalUsers) return 0;
    return (metrics.wau / metrics.totalUsers) * 100;
  }, [metrics.wau, metrics.totalUsers]);

  const mauRate = useMemo(() => {
    if (!metrics.totalUsers) return 0;
    return (metrics.mau / metrics.totalUsers) * 100;
  }, [metrics.mau, metrics.totalUsers]);

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
          totalEditorialCollectionsRes,
          publishedEditorialCollectionsRes,

          activity30dRes,

          recentUsersRes,
          recentRatingsRes,
          recentWatchlistRes,
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

          supabase
            .from("user_title_activities")
            .select("*", { count: "exact", head: true })
            .not("rating", "is", null),

          supabase
            .from("user_title_activities")
            .select("*", { count: "exact", head: true })
            .not("rating", "is", null)
            .gte("watched_at", todayIso),

          supabase
            .from("user_title_activities")
            .select("*", { count: "exact", head: true })
            .not("rating", "is", null)
            .gte("watched_at", sevenIso),

          supabase
            .from("user_title_activities")
            .select("*", { count: "exact", head: true })
            .not("rating", "is", null)
            .gte("watched_at", thirtyIso),

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
            .from("editorial_collections")
            .select("*", { count: "exact", head: true }),

          supabase
            .from("editorial_collections")
            .select("*", { count: "exact", head: true })
            .eq("is_published", true),

          supabase
            .from("user_title_activities")
            .select("user_id, watched_at")
            .gte("watched_at", thirtyIso),

          supabase
            .from("profiles")
            .select("id, username, display_name, created_at")
            .order("created_at", { ascending: false })
            .limit(8),

          supabase
            .from("user_title_activities")
            .select("id, user_id, tmdb_id, rating, watched_at")
            .not("rating", "is", null)
            .order("watched_at", { ascending: false })
            .limit(8),

          supabase
            .from("watchlist")
            .select("id, user_id, tmdb_id, created_at")
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

        const queryErrors = [
          totalUsersRes.error,
          newUsersTodayRes.error,
          newUsers7dRes.error,
          newUsers30dRes.error,
          onboardingCompletedRes.error,
          totalRatingsRes.error,
          ratingsTodayRes.error,
          ratings7dRes.error,
          ratings30dRes.error,
          watchlistTodayRes.error,
          watchlist7dRes.error,
          watchlist30dRes.error,
          totalPeeklistsRes.error,
          publishedBuzzRes.error,
          totalEditorialCollectionsRes.error,
          publishedEditorialCollectionsRes.error,
          activity30dRes.error,
          recentUsersRes.error,
          recentRatingsRes.error,
          recentWatchlistRes.error,
          recentBuzzRes.error,
        ]
          .filter(Boolean)
          .map((e: any) => e.message)
          .join(" · ");

        if (queryErrors) {
          setError(queryErrors);
        }

        const activityRows =
          (activity30dRes.data as Array<{
            user_id: string;
            watched_at?: string | null;
          }> | null) ?? [];

        const dauSet = new Set<string>();
        const wauSet = new Set<string>();
        const mauSet = new Set<string>();

        const now = Date.now();
        const oneDayMs = 1 * 24 * 60 * 60 * 1000;
        const sevenDayMs = 7 * 24 * 60 * 60 * 1000;
        const thirtyDayMs = 30 * 24 * 60 * 60 * 1000;

        for (const row of activityRows) {
          if (!row.user_id || !row.watched_at) continue;
          const ts = new Date(row.watched_at).getTime();
          const diff = now - ts;

          if (diff <= oneDayMs) dauSet.add(row.user_id);
          if (diff <= sevenDayMs) wauSet.add(row.user_id);
          if (diff <= thirtyDayMs) mauSet.add(row.user_id);
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
          totalEditorialCollections: totalEditorialCollectionsRes.count ?? 0,
          publishedEditorialCollections: publishedEditorialCollectionsRes.count ?? 0,
        });

        setRecentUsers((recentUsersRes.data as RecentUser[] | null) ?? []);

        const mappedRecentRatings =
          ((recentRatingsRes.data as Array<{
            id: number | string;
            user_id: string;
            tmdb_id: number;
            rating: number;
            watched_at?: string | null;
          }> | null) ?? []).map((item) => ({
            id: item.id,
            user_id: item.user_id,
            tmdb_id: item.tmdb_id,
            rating: item.rating,
            created_at: item.watched_at ?? null,
          })) ?? [];

        setRecentRatings(mappedRecentRatings);

        setRecentWatchlist(
          (recentWatchlistRes.data as RecentWatchlist[] | null) ?? []
        );

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

        .analytics-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .analytics-links {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .analytics-link {
          display: block;
          text-decoration: none;
          color: white;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          padding: 14px 16px;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }

        .analytics-link:hover {
          transform: translateY(-1px);
          border-color: rgba(250,0,130,0.55);
          background: rgba(250,0,130,0.08);
        }

        .analytics-link-title {
          font-size: 15px;
          font-weight: 800;
          color: white;
        }

        .analytics-link-sub {
          margin-top: 6px;
          font-size: 13px;
          color: rgba(255,255,255,0.68);
          line-height: 1.5;
        }

        @media (min-width: 900px) {
          .grid-cards {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .three-col {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .tables {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .analytics-links {
            grid-template-columns: repeat(2, minmax(0, 1fr));
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
                <div className="card-sub">
                  Usuarios activos últimas 24h · {formatPct(dauRate)} of users
                </div>
              </div>

              <div className="card">
                <div className="card-label">WAU</div>
                <div className="card-value">{formatNumber(metrics.wau)}</div>
                <div className="card-sub">
                  Usuarios activos últimos 7 días · {formatPct(wauRate)} of users
                </div>
              </div>

              <div className="card">
                <div className="card-label">MAU</div>
                <div className="card-value">{formatNumber(metrics.mau)}</div>
                <div className="card-sub">
                  Usuarios activos últimos 30 días · {formatPct(mauRate)} of users
                </div>
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
                  <div className="mini-metric">
                    <div className="mini-name">Editorial collections</div>
                    <div className="mini-value">{formatNumber(metrics.totalEditorialCollections)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">Published editorial</div>
                    <div className="mini-value">{formatNumber(metrics.publishedEditorialCollections)}</div>
                  </div>
                </div>

                <div className="card">
                  <div className="mini-metric">
                    <div className="mini-name">DAU / Users</div>
                    <div className="mini-value">{formatPct(dauRate)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">WAU / Users</div>
                    <div className="mini-value">{formatPct(wauRate)}</div>
                  </div>
                  <div className="mini-metric">
                    <div className="mini-name">MAU / Users</div>
                    <div className="mini-value">{formatPct(mauRate)}</div>
                  </div>
                </div>

                <div className="card analytics-card">
                  <div className="mini-metric">
                    <div className="mini-name">Web analytics</div>
                    <div className="mini-value">Live</div>
                  </div>
                  <div className="section-note">
                    Vercel ya está midiendo tráfico web. Desde aquí entras rápido a páginas, visitantes y fuentes.
                  </div>
                </div>
              </div>
            </section>

            <section className="section">
              <h2>Web Analytics</h2>
              <p className="section-note">
                Accesos rápidos al panel de Vercel para revisar tráfico web, páginas más vistas y adquisición.
              </p>

              <div className="analytics-links">
                <a
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="analytics-link"
                >
                  <div className="analytics-link-title">Open Vercel dashboard</div>
                  <div className="analytics-link-sub">
                    Entra al proyecto y revisa el overview general de deployment, usage y analytics.
                  </div>
                </a>

                <a
                  href="https://vercel.com/analytics"
                  target="_blank"
                  rel="noreferrer"
                  className="analytics-link"
                >
                  <div className="analytics-link-title">Open Web Analytics</div>
                  <div className="analytics-link-sub">
                    Pageviews, visitantes únicos, top pages y tendencias recientes del sitio.
                  </div>
                </a>

                <a
                  href="https://vercel.com/analytics?view=pages"
                  target="_blank"
                  rel="noreferrer"
                  className="analytics-link"
                >
                  <div className="analytics-link-title">Top pages</div>
                  <div className="analytics-link-sub">
                    Revisa qué URLs están concentrando el tráfico y cuáles conviene optimizar primero.
                  </div>
                </a>

                <a
                  href="https://vercel.com/analytics?view=sources"
                  target="_blank"
                  rel="noreferrer"
                  className="analytics-link"
                >
                  <div className="analytics-link-title">Traffic sources</div>
                  <div className="analytics-link-sub">
                    Mira referrers, adquisición y desde dónde llega la gente a Peekr web.
                  </div>
                </a>
              </div>
            </section>

            <section className="section">
              <h2>Recent activity</h2>
              <p className="section-note">Panel inicial con tablas rápidas para monitoreo manual.</p>

              <div className="tables">
                <div className="table-card">
                  <h3>Recent signups</h3>
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
                  <h3>Recent watchlist adds</h3>
                  {recentWatchlist.map((item) => (
                    <div key={item.id} className="row">
                      <div className="row-left">
                        <div className="row-title">TMDB {item.tmdb_id}</div>
                        <div className="row-sub">user {item.user_id.slice(0, 8)}</div>
                      </div>
                      <div className="row-right">{formatDate(item.created_at)}</div>
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
