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

type PendingArticle = {
  id: number;
  title: string;
  summary?: string | null;
  source_name?: string | null;
  language: string;
  image_url?: string | null;
  published_at?: string | null;
};

type PendingCarousel = {
  id: string;
  draft_type?: string | null;
  hook_text?: string | null;
  bullet_points?: string[] | null;
  seed_title?: string | null;
  source_label?: string | null;
  seed_poster_url?: string | null;
  slide_urls?: string[] | null;
  language?: string | null;
  generated_at?: string | null;
  caption?: string | null;
};

type PendingCreator = {
  id: string;
  user_id: string;
  created_at?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type NewsletterEdition = {
  id: number;
  edition_date: string;
  status: string;
  content_json: {
    topOnPeekr:  Array<{ title: string; tmdbId: number; mediaType: string; tmdbRating: number; platforms: string[] }>;
    newReleases: Array<{ title: string; tmdbId: number; mediaType: string; tmdbRating: number; platforms: string[] }>;
    editionDate:   string;
    editionDatePt: string;
  };
  created_at: string;
  total_sent?: number | null;
};

type PublishedCarousel = {
  id: string;
  draft_type?: string | null;
  hook_text?: string | null;
  seed_title?: string | null;
  seed_poster_url?: string | null;
  source_label?: string | null;
  language?: string | null;
  slide_urls?: string[] | null;
  scheduled_for?: string | null;
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

const CAROUSEL_TYPE_COLORS: Record<string, string> = {
  actualidad: "#06b6d4",
  actor: "#a855f7",
  lanzamiento: "#f97316",
  reco: "#22c55e",
};

/** Build a /api/slides URL for a given carousel draft */
function buildSlideUrl(
  type: string,
  slide: 1 | 2 | 3 | 4,
  opts: {
    hook?: string | null;
    point?: string | null;
    img?: string | null;
    title?: string | null;
    source?: string | null;
    lang?: string | null;
  }
) {
  const p = new URLSearchParams();
  p.set("type", type || "actualidad");
  p.set("slide", String(slide));
  if (opts.hook)   p.set("hook",   opts.hook.slice(0, 200));
  if (opts.point)  p.set("point",  opts.point.slice(0, 200));
  if (opts.img)    p.set("img",    opts.img);
  if (opts.title)  p.set("title",  opts.title.slice(0, 80));
  if (opts.source) p.set("source", opts.source.slice(0, 60));
  if (opts.lang)   p.set("lang",   opts.lang === "pt" ? "pt" : "es");
  return `/api/slides?${p.toString()}`;
}

/** Tiny carousel preview with slide switcher for the admin card */
function CarouselPreviewCard({ carousel }: { carousel: PendingCarousel }) {
  const [activeSlide, setActiveSlide] = useState<1 | 2 | 3 | 4>(1);
  const type = carousel.draft_type || "actualidad";
  const pts = carousel.bullet_points ?? [];

  const urlFor = (slide: 1 | 2 | 3 | 4) =>
    buildSlideUrl(type, slide, {
      hook:   carousel.hook_text,
      point:  slide === 2 ? pts[0] : pts[1],
      img:    carousel.seed_poster_url,
      title:  carousel.seed_title,
      source: carousel.source_label,
      lang:   carousel.language,
    });

  return (
    <div>
      {/* Main preview */}
      <div className="carousel-preview-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={activeSlide}
          src={urlFor(activeSlide)}
          alt={`Slide ${activeSlide}`}
          className="carousel-preview-img"
          loading="lazy"
        />
      </div>
      {/* Thumbnails */}
      <div className="carousel-preview-thumbs">
        {([1, 2, 3, 4] as const).map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s}
            src={urlFor(s)}
            alt={`Slide ${s}`}
            className={`carousel-thumb${activeSlide === s ? " active" : ""}`}
            loading="lazy"
            onClick={() => setActiveSlide(s)}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [state, setState] = useState<AdminState>("loading");
  const [email, setEmail] = useState<string>("");
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"pending" | "metrics" | "published">("pending");
  const [pendingCounts, setPendingCounts] = useState({ articles: 0, carousels: 0, creators: 0, newsletters: 0 });
  const [pendingArticles, setPendingArticles] = useState<PendingArticle[]>([]);
  const [pendingCarousels, setPendingCarousels] = useState<PendingCarousel[]>([]);
  const [pendingCreators, setPendingCreators] = useState<PendingCreator[]>([]);
  const [pendingNewsletters, setPendingNewsletters] = useState<NewsletterEdition[]>([]);
  const [sendingNewsletterId, setSendingNewsletterId] = useState<number | null>(null);
  const [publishedCarousels, setPublishedCarousels] = useState<PublishedCarousel[]>([]);

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

  const totalPending = pendingCounts.articles + pendingCounts.carousels + pendingCounts.creators + pendingCounts.newsletters;

  async function loadPendingData() {
    const [
      articlesCountRes,
      carouselsCountRes,
      creatorsCountRes,
      newslettersCountRes,
      pendingArticlesRes,
      pendingCarouselsRes,
      pendingCreatorsRes,
      pendingNewslettersRes,
      publishedCarouselsRes,
    ] = await Promise.all([
      supabase
        .from("peekrbuzz_articles")
        .select("*", { count: "exact", head: true })
        .eq("review_status", "pending_review"),
      supabase
        .from("peekrbuzz_ig_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase
        .from("creator_applications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("newsletter_editions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase
        .from("peekrbuzz_articles")
        .select("id, title, summary, source_name, language, image_url, published_at")
        .eq("review_status", "pending_review")
        .order("published_at", { ascending: false })
        .limit(20),
      supabase
        .from("peekrbuzz_ig_queue")
        .select(
          "id, draft_type, hook_text, bullet_points, seed_title, source_label, seed_poster_url, slide_urls, language, generated_at, caption"
        )
        .eq("status", "pending_review")
        .order("generated_at", { ascending: false })
        .limit(20),
      supabase
        .from("creator_applications")
        .select("id, user_id, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("newsletter_editions")
        .select("id, edition_date, status, content_json, created_at, total_sent")
        .eq("status", "pending_review")
        .order("edition_date", { ascending: false })
        .limit(5),
      supabase
        .from("peekrbuzz_ig_queue")
        .select("id, draft_type, hook_text, seed_title, seed_poster_url, source_label, language, slide_urls, scheduled_for")
        .eq("status", "published")
        .order("scheduled_for", { ascending: false })
        .limit(30),
    ]);

    setPendingCounts({
      articles:     articlesCountRes.count ?? 0,
      carousels:    carouselsCountRes.count ?? 0,
      creators:     creatorsCountRes.count ?? 0,
      newsletters:  newslettersCountRes.count ?? 0,
    });

    setPendingArticles((pendingArticlesRes.data as PendingArticle[] | null) ?? []);
    setPendingCarousels((pendingCarouselsRes.data as PendingCarousel[] | null) ?? []);
    setPendingNewsletters((pendingNewslettersRes.data as NewsletterEdition[] | null) ?? []);

    // Enrich creator applications with profile data
    const creatorApps = (pendingCreatorsRes.data as Array<{
      id: string;
      user_id: string;
      created_at?: string | null;
    }> | null) ?? [];

    if (creatorApps.length > 0) {
      const userIds = creatorApps.map((a) => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null }) => [p.id, p])
      );

      const enriched: PendingCreator[] = creatorApps.map((app) => {
        const profile = profileMap.get(app.user_id);
        return {
          id: app.id,
          user_id: app.user_id,
          created_at: app.created_at,
          username: profile?.username ?? null,
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        };
      });

      setPendingCreators(enriched);
    } else {
      setPendingCreators([]);
    }

    setPublishedCarousels((publishedCarouselsRes.data as PublishedCarousel[] | null) ?? []);
  }

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

        // Load pending / published data in parallel with rest
        if (mounted) {
          await loadPendingData();
        }

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

  // --- Action handlers ---

  async function approveArticle(id: number) {
    setPendingArticles((prev) => prev.filter((a) => a.id !== id));
    setPendingCounts((prev) => ({ ...prev, articles: Math.max(0, prev.articles - 1) }));
    await supabase
      .from("peekrbuzz_articles")
      .update({ is_published: true, review_status: "published" })
      .eq("id", id);
  }

  async function rejectArticle(id: number) {
    setPendingArticles((prev) => prev.filter((a) => a.id !== id));
    setPendingCounts((prev) => ({ ...prev, articles: Math.max(0, prev.articles - 1) }));
    await supabase
      .from("peekrbuzz_articles")
      .update({ review_status: "rejected" })
      .eq("id", id);
  }

  async function approveCarousel(id: string) {
    const carousel = pendingCarousels.find((c) => c.id === id);
    // Optimistic UI update
    setPendingCarousels((prev) => prev.filter((c) => c.id !== id));
    setPendingCounts((prev) => ({ ...prev, carousels: Math.max(0, prev.carousels - 1) }));

    const baseUpdate = {
      status: "approved",
      scheduled_for: new Date().toISOString(),
    };

    if (!carousel) {
      await supabase.from("peekrbuzz_ig_queue").update(baseUpdate).eq("id", id);
      return;
    }

    // Render all 4 slides → upload to Supabase Storage → persist slide_urls
    try {
      const pts = carousel.bullet_points ?? [];
      const lang = carousel.language === "pt" ? "pt" : "es";

      // Fetch all 4 rendered PNGs in parallel from /api/slides
      const slideBlobs = await Promise.all(
        ([1, 2, 3, 4] as const).map((slide) =>
          fetch(
            buildSlideUrl(carousel.draft_type || "actualidad", slide, {
              hook:   carousel.hook_text,
              point:  slide === 2 ? (pts[0] ?? null) : (pts[1] ?? null),
              img:    carousel.seed_poster_url,
              title:  carousel.seed_title,
              source: carousel.source_label,
              lang,
            })
          ).then((r) => r.blob())
        )
      );

      // Upload each PNG to buzz-slides/{id}/slide-{n}.png
      await Promise.all(
        slideBlobs.map((blob, i) =>
          supabase.storage
            .from("buzz-slides")
            .upload(`${id}/slide-${i + 1}.png`, blob, {
              contentType: "image/png",
              upsert: true,
            })
        )
      );

      // Build public URLs
      const slideUrls = ([1, 2, 3, 4] as const).map((n) => {
        const { data } = supabase.storage
          .from("buzz-slides")
          .getPublicUrl(`${id}/slide-${n}.png`);
        return data.publicUrl;
      });

      await supabase
        .from("peekrbuzz_ig_queue")
        .update({ ...baseUpdate, slide_urls: slideUrls })
        .eq("id", id);
    } catch (err) {
      // Render failed — approve anyway without slide URLs
      console.error("approveCarousel: slide render/upload failed:", err);
      await supabase.from("peekrbuzz_ig_queue").update(baseUpdate).eq("id", id);
    }
  }

  async function rejectCarousel(id: string) {
    setPendingCarousels((prev) => prev.filter((c) => c.id !== id));
    setPendingCounts((prev) => ({ ...prev, carousels: Math.max(0, prev.carousels - 1) }));
    await supabase
      .from("peekrbuzz_ig_queue")
      .update({ status: "rejected" })
      .eq("id", id);
  }

  async function approveCreator(id: string, userId: string) {
    setPendingCreators((prev) => prev.filter((c) => c.id !== id));
    setPendingCounts((prev) => ({ ...prev, creators: Math.max(0, prev.creators - 1) }));
    await Promise.all([
      supabase.from("creator_applications").update({ status: "approved" }).eq("id", id),
      supabase.from("profiles").update({ creator_status: "approved" }).eq("id", userId),
    ]);
  }

  async function rejectCreator(id: string, userId: string) {
    setPendingCreators((prev) => prev.filter((c) => c.id !== id));
    setPendingCounts((prev) => ({ ...prev, creators: Math.max(0, prev.creators - 1) }));
    await Promise.all([
      supabase.from("creator_applications").update({ status: "rejected" }).eq("id", id),
      supabase.from("profiles").update({ creator_status: "none" }).eq("id", userId),
    ]);
  }

  async function sendNewsletter(id: number) {
    setSendingNewsletterId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session");

      const res = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ edition_id: id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError((data as any).error ?? `Error ${res.status} al enviar newsletter`);
        return;
      }

      // Optimistic remove from pending list
      setPendingNewsletters((prev) => prev.filter((n) => n.id !== id));
      setPendingCounts((prev) => ({ ...prev, newsletters: Math.max(0, prev.newsletters - 1) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error enviando newsletter");
    } finally {
      setSendingNewsletterId(null);
    }
  }

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

        .admin-tabs {
          display: flex;
          gap: 4px;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 32px;
          flex-wrap: wrap;
        }

        .admin-tab {
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.6);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .admin-tab.active {
          background: rgba(250,0,130,0.12);
          border-color: #FA0082;
          color: #FA0082;
        }

        .admin-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #FA0082;
          color: white;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
        }

        .section-title {
          font-size: 17px;
          font-weight: 800;
          color: white;
          margin: 0 0 14px 0;
          padding-top: 24px;
        }

        .section-title:first-child { padding-top: 0; }

        .section-empty {
          padding: 28px;
          text-align: center;
          color: rgba(255,255,255,0.4);
          font-size: 14px;
          background: rgba(255,255,255,0.02);
          border-radius: 12px;
        }

        .review-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        @media(min-width: 900px) {
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

          .review-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .review-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .review-card-top {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .review-card-thumb {
          width: 72px;
          height: 72px;
          border-radius: 10px;
          object-fit: cover;
          flex-shrink: 0;
          background: rgba(255,255,255,0.08);
        }

        /* Carousel slide preview */
        .carousel-preview-wrap {
          width: 100%;
          position: relative;
          overflow: hidden;
          border-radius: 10px;
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 4px;
        }

        .carousel-preview-img {
          width: 100%;
          aspect-ratio: 4 / 5;
          object-fit: cover;
          display: block;
          border-radius: 10px;
        }

        .carousel-preview-thumbs {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 4px 0;
        }

        .carousel-preview-thumbs::-webkit-scrollbar { display: none; }

        .carousel-thumb {
          flex-shrink: 0;
          width: 54px;
          height: 67px;
          border-radius: 6px;
          object-fit: cover;
          cursor: pointer;
          border: 2px solid transparent;
          opacity: 0.65;
          transition: opacity 0.15s, border-color 0.15s;
        }

        .carousel-thumb:hover { opacity: 1; }
        .carousel-thumb.active { opacity: 1; border-color: #FA0082; }

        .carousel-preview-loading {
          width: 100%;
          aspect-ratio: 4 / 5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          color: rgba(255,255,255,0.3);
          border-radius: 10px;
        }

        .review-card-body {
          flex: 1;
          min-width: 0;
        }

        .review-card-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }

        .review-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.7);
        }

        .review-hook {
          font-size: 14px;
          font-weight: 700;
          color: white;
          line-height: 1.4;
          margin-bottom: 4px;
        }

        .review-summary {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          line-height: 1.5;
        }

        .review-meta {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          margin-top: 2px;
        }

        .review-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .btn-approve {
          padding: 7px 14px;
          border-radius: 8px;
          background: rgba(0,200,100,0.15);
          border: 1px solid rgba(0,200,100,0.3);
          color: #00c864;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }

        .btn-reject {
          padding: 7px 14px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.45);
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }

        .creator-avatar {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          object-fit: cover;
          background: rgba(255,255,255,0.1);
          display: block;
          flex-shrink: 0;
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
            {/* Tab navigation */}
            <div className="admin-tabs">
              <button
                className={`admin-tab${activeTab === "pending" ? " active" : ""}`}
                onClick={() => setActiveTab("pending")}
              >
                Pendientes
                {totalPending > 0 && (
                  <span className="admin-badge">{totalPending}</span>
                )}
              </button>
              <button
                className={`admin-tab${activeTab === "metrics" ? " active" : ""}`}
                onClick={() => setActiveTab("metrics")}
              >
                Metricas
              </button>
              <button
                className={`admin-tab${activeTab === "published" ? " active" : ""}`}
                onClick={() => setActiveTab("published")}
              >
                Publicados
              </button>
            </div>

            {/* ===================== TAB: PENDIENTES ===================== */}
            <div style={{ display: activeTab === "pending" ? "block" : "none" }}>

              {/* Section A: Articulos Buzz */}
              <p className="section-title">
                Articulos Buzz
                {pendingCounts.articles > 0 && (
                  <span className="admin-badge" style={{ marginLeft: 8 }}>
                    {pendingCounts.articles}
                  </span>
                )}
              </p>
              {pendingArticles.length === 0 ? (
                <div className="section-empty">Sin articulos pendientes</div>
              ) : (
                <div className="review-grid">
                  {pendingArticles.map((article) => (
                    <div key={article.id} className="review-card">
                      <div className="review-card-top">
                        {article.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={article.image_url}
                            alt=""
                            className="review-card-thumb"
                          />
                        ) : null}
                        <div className="review-card-body">
                          <div className="review-card-badges">
                            <span className="review-badge">{article.language}</span>
                            {article.source_name && (
                              <span className="review-badge">{article.source_name}</span>
                            )}
                          </div>
                          <div className="review-hook">{article.title}</div>
                          {article.summary && (
                            <div className="review-summary">
                              {article.summary.length > 140
                                ? article.summary.slice(0, 140) + "..."
                                : article.summary}
                            </div>
                          )}
                          <div className="review-meta">{formatDate(article.published_at)}</div>
                        </div>
                      </div>
                      <div className="review-actions">
                        <button
                          className="btn-approve"
                          onClick={() => approveArticle(article.id)}
                        >
                          Aprobar
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => rejectArticle(article.id)}
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Section B: Carruseles IG */}
              <p className="section-title" style={{ paddingTop: 32 }}>
                Carruseles IG
                {pendingCounts.carousels > 0 && (
                  <span className="admin-badge" style={{ marginLeft: 8 }}>
                    {pendingCounts.carousels}
                  </span>
                )}
              </p>
              {pendingCarousels.length === 0 ? (
                <div className="section-empty">Sin carruseles pendientes</div>
              ) : (
                <div className="review-grid">
                  {pendingCarousels.map((carousel) => {
                    const typeColor =
                      carousel.draft_type
                        ? CAROUSEL_TYPE_COLORS[carousel.draft_type] ?? "rgba(255,255,255,0.4)"
                        : "rgba(255,255,255,0.4)";
                    return (
                      <div key={carousel.id} className="review-card">

                        {/* ── Live slide preview ── */}
                        <CarouselPreviewCard carousel={carousel} />

                        {/* ── Text metadata ── */}
                        <div className="review-card-badges" style={{ paddingTop: 4 }}>
                          {carousel.draft_type && (
                            <span
                              className="review-badge"
                              style={{ background: typeColor + "22", color: typeColor }}
                            >
                              {carousel.draft_type}
                            </span>
                          )}
                          {carousel.language && (
                            <span className="review-badge">{carousel.language}</span>
                          )}
                        </div>
                        {(carousel.seed_title || carousel.source_label) && (
                          <div className="review-summary" style={{ marginBottom: 2 }}>
                            {carousel.seed_title || carousel.source_label}
                          </div>
                        )}
                        {carousel.hook_text && (
                          <div className="review-hook">{carousel.hook_text}</div>
                        )}
                        {carousel.bullet_points && carousel.bullet_points.length > 0 && (
                          <div className="review-summary">
                            {carousel.bullet_points.slice(0, 2).map((bp, i) => (
                              <div key={i}>• {bp}</div>
                            ))}
                          </div>
                        )}
                        <div className="review-meta">{formatDate(carousel.generated_at)}</div>

                        <div className="review-actions">
                          <button
                            className="btn-approve"
                            onClick={() => approveCarousel(carousel.id)}
                          >
                            Aprobar
                          </button>
                          <button
                            className="btn-reject"
                            onClick={() => rejectCarousel(carousel.id)}
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Section C: Creators */}
              <p className="section-title" style={{ paddingTop: 32 }}>
                Creators
                {pendingCounts.creators > 0 && (
                  <span className="admin-badge" style={{ marginLeft: 8 }}>
                    {pendingCounts.creators}
                  </span>
                )}
              </p>
              {pendingCreators.length === 0 ? (
                <div className="section-empty">Sin solicitudes de creators</div>
              ) : (
                <div className="review-grid">
                  {pendingCreators.map((creator) => (
                    <div key={creator.id} className="review-card">
                      <div className="review-card-top" style={{ alignItems: "center" }}>
                        {creator.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={creator.avatar_url}
                            alt=""
                            className="creator-avatar"
                          />
                        ) : (
                          <div
                            className="creator-avatar"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            {(creator.username ?? creator.user_id).slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="review-card-body">
                          <div className="review-hook" style={{ fontSize: 13 }}>
                            @{creator.username || creator.user_id.slice(0, 8)}
                          </div>
                          {creator.display_name && (
                            <div className="review-summary">{creator.display_name}</div>
                          )}
                          <div className="review-meta">{formatDate(creator.created_at)}</div>
                        </div>
                      </div>
                      <div className="review-actions">
                        <button
                          className="btn-approve"
                          onClick={() => approveCreator(creator.id, creator.user_id)}
                        >
                          Aprobar
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => rejectCreator(creator.id, creator.user_id)}
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Section D: Newsletter */}
              <p className="section-title" style={{ paddingTop: 32 }}>
                Newsletter semanal
                {pendingCounts.newsletters > 0 && (
                  <span className="admin-badge" style={{ marginLeft: 8 }}>
                    {pendingCounts.newsletters}
                  </span>
                )}
              </p>
              {pendingNewsletters.length === 0 ? (
                <div className="section-empty">Sin newsletters pendientes de envío</div>
              ) : (
                <div className="review-grid">
                  {pendingNewsletters.map((edition) => {
                    const topTitles  = edition.content_json?.topOnPeekr  ?? [];
                    const newReleases = edition.content_json?.newReleases ?? [];
                    const isSending  = sendingNewsletterId === edition.id;
                    return (
                      <div key={edition.id} className="review-card">
                        <div className="review-card-badges">
                          <span className="review-badge">📧 Newsletter</span>
                          <span className="review-badge">{edition.edition_date}</span>
                        </div>

                        <div className="review-hook" style={{ fontSize: 14, marginTop: 4 }}>
                          Edición del {edition.edition_date}
                        </div>
                        <div className="review-meta">Generada {formatDate(edition.created_at)}</div>

                        {topTitles.length > 0 && (
                          <div className="review-summary" style={{ marginTop: 6 }}>
                            <strong style={{ color: "rgba(255,255,255,0.8)" }}>
                              🔥 Top Peekr esta semana:
                            </strong>
                            <div style={{ marginTop: 2 }}>
                              {topTitles.slice(0, 4).map((t, i) => (
                                <div key={i}>
                                  {i + 1}. {t.title}
                                  {t.tmdbRating > 0 && (
                                    <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 4 }}>
                                      ★ {t.tmdbRating.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {newReleases.length > 0 && (
                          <div className="review-summary" style={{ marginTop: 6 }}>
                            <strong style={{ color: "rgba(255,255,255,0.8)" }}>
                              🎬 Nuevos lanzamientos:
                            </strong>
                            <div style={{ marginTop: 2 }}>
                              {newReleases.slice(0, 4).map((r, i) => (
                                <div key={i}>
                                  {i + 1}. {r.title}
                                  {r.platforms?.length > 0 && (
                                    <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 4 }}>
                                      · {r.platforms.slice(0, 2).join(", ")}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="review-actions" style={{ marginTop: 8 }}>
                          <button
                            className="btn-approve"
                            onClick={() => sendNewsletter(edition.id)}
                            disabled={isSending}
                            style={{
                              opacity: isSending ? 0.6 : 1,
                              cursor: isSending ? "not-allowed" : "pointer",
                              padding: "8px 16px",
                            }}
                          >
                            {isSending ? "Enviando..." : "✉️ Enviar newsletter"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ===================== TAB: METRICAS ===================== */}
            <div style={{ display: activeTab === "metrics" ? "block" : "none" }}>
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
                    Usuarios activos ultimas 24h · {formatPct(dauRate)} of users
                  </div>
                </div>

                <div className="card">
                  <div className="card-label">WAU</div>
                  <div className="card-value">{formatNumber(metrics.wau)}</div>
                  <div className="card-sub">
                    Usuarios activos ultimos 7 dias · {formatPct(wauRate)} of users
                  </div>
                </div>

                <div className="card">
                  <div className="card-label">MAU</div>
                  <div className="card-value">{formatNumber(metrics.mau)}</div>
                  <div className="card-sub">
                    Usuarios activos ultimos 30 dias · {formatPct(mauRate)} of users
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

              <section className="section" style={{ marginTop: 28 }}>
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

              <section className="section" style={{ marginTop: 28 }}>
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
                      Vercel ya esta midiendo trafico web. Desde aqui entras rapido a paginas, visitantes y fuentes.
                    </div>
                  </div>
                </div>
              </section>

              <section className="section" style={{ marginTop: 28 }}>
                <h2>Web Analytics</h2>
                <p className="section-note">
                  Accesos rapidos al panel de Vercel para revisar trafico web, paginas mas vistas y adquisicion.
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
                      Pageviews, visitantes unicos, top pages y tendencias recientes del sitio.
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
                      Revisa que URLs estan concentrando el trafico y cuales conviene optimizar primero.
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
                      Mira referrers, adquisicion y desde donde llega la gente a Peekr web.
                    </div>
                  </a>
                </div>
              </section>

              <section className="section" style={{ marginTop: 28 }}>
                <h2>Recent activity</h2>
                <p className="section-note">Panel inicial con tablas rapidas para monitoreo manual.</p>

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
                          &#9733; {item.rating}
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
            </div>

            {/* ===================== TAB: PUBLICADOS ===================== */}
            <div style={{ display: activeTab === "published" ? "block" : "none" }}>
              <p className="section-title">Carruseles publicados</p>
              {publishedCarousels.length === 0 ? (
                <div className="section-empty">Sin carruseles publicados</div>
              ) : (
                <div className="review-grid">
                  {publishedCarousels.map((carousel) => {
                    const typeColor =
                      carousel.draft_type
                        ? CAROUSEL_TYPE_COLORS[carousel.draft_type] ?? "rgba(255,255,255,0.4)"
                        : "rgba(255,255,255,0.4)";
                    const previewUrl = buildSlideUrl(
                      carousel.draft_type || "actualidad",
                      1,
                      {
                        hook: carousel.hook_text,
                        img: carousel.seed_poster_url,
                        title: carousel.seed_title,
                        source: carousel.source_label,
                        lang: carousel.language,
                      }
                    );
                    return (
                      <div key={carousel.id} className="review-card">
                        {/* Live slide 1 preview */}
                        <div className="carousel-preview-wrap">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewUrl}
                            alt="Slide 1"
                            className="carousel-preview-img"
                            loading="lazy"
                          />
                        </div>
                        <div className="review-card-badges" style={{ paddingTop: 4 }}>
                          {carousel.draft_type && (
                            <span
                              className="review-badge"
                              style={{ background: typeColor + "22", color: typeColor }}
                            >
                              {carousel.draft_type}
                            </span>
                          )}
                          {carousel.language && (
                            <span className="review-badge">{carousel.language}</span>
                          )}
                        </div>
                        {carousel.hook_text && (
                          <div className="review-hook">{carousel.hook_text}</div>
                        )}
                        {carousel.seed_title && (
                          <div className="review-summary">{carousel.seed_title}</div>
                        )}
                        <div className="review-meta">
                          {formatDate(carousel.scheduled_for)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
