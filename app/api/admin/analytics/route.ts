import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/analytics
 *
 * Server-side proxy to PostHog HogQL API. The Personal API Key never
 * touches the browser — admins call this route, route auths them, then
 * forwards an allowlisted query kind to PostHog.
 *
 * Body: { kind: "events_summary" | "dau" | "funnel" | "retention_cohort"
 *               | "country_breakdown" | "screen_time" }
 */

type QueryKind =
  | "events_summary"
  | "dau_14d"
  | "funnel_7d"
  | "retention_cohort_14d"
  | "country_breakdown_7d"
  | "rating_timing_14d";

const HOST = process.env.POSTHOG_API_HOST ?? "https://us.posthog.com";

const QUERIES: Record<QueryKind, string> = {
  events_summary: `
    SELECT event, count() AS n, count(DISTINCT distinct_id) AS uniq
    FROM events
    WHERE timestamp > now() - INTERVAL 7 DAY
    GROUP BY event
    ORDER BY n DESC
    LIMIT 40
  `,
  dau_14d: `
    SELECT toDate(timestamp) AS day, count(DISTINCT distinct_id) AS dau
    FROM events
    WHERE event IN ('Application Opened','app_opened')
      AND timestamp > now() - INTERVAL 14 DAY
    GROUP BY day
    ORDER BY day DESC
  `,
  funnel_7d: `
    SELECT
      countIf(event = 'Application Installed') AS installs,
      countIf(event = 'onboarding_step_completed') AS onboarding_steps,
      countIf(event = 'first_follow') AS first_follow,
      uniqIf(distinct_id, event = 'Application Installed') AS install_users,
      uniqIf(distinct_id, event = 'onboarding_step_completed') AS onboarding_users,
      uniqIf(distinct_id, event = 'first_follow') AS first_follow_users
    FROM events
    WHERE timestamp > now() - INTERVAL 7 DAY
  `,
  retention_cohort_14d: `
    SELECT
      toDate(min(timestamp)) AS install_day,
      count(DISTINCT distinct_id) AS cohort_size
    FROM events
    WHERE event = 'Application Installed'
      AND timestamp > now() - INTERVAL 14 DAY
    GROUP BY install_day
    ORDER BY install_day DESC
  `,
  country_breakdown_7d: `
    SELECT
      properties.$geoip_country_code AS country,
      count(DISTINCT distinct_id) AS users,
      count() AS events
    FROM events
    WHERE timestamp > now() - INTERVAL 7 DAY
    GROUP BY country
    ORDER BY users DESC
    LIMIT 20
  `,
  rating_timing_14d: `
    SELECT event, count() AS n
    FROM events
    WHERE event IN ('immersive_feed_opened','immersive_feed_session','immersive_feed_detail_tap','review_prompt_shown','review_prompt_completed')
      AND timestamp > now() - INTERVAL 14 DAY
    GROUP BY event
    ORDER BY n DESC
  `,
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { kind?: QueryKind };
  const kind = body.kind;
  if (!kind || !(kind in QUERIES)) {
    return NextResponse.json({ error: `Unknown kind: ${kind}` }, { status: 400 });
  }

  const personalKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!personalKey || !projectId) {
    return NextResponse.json(
      { error: "Server misconfiguration: POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID missing" },
      { status: 500 },
    );
  }

  const phRes = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${personalKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query: QUERIES[kind] },
    }),
  });

  if (!phRes.ok) {
    const text = await phRes.text();
    return NextResponse.json({ error: "PostHog error", detail: text }, { status: 502 });
  }

  const data = await phRes.json();
  return NextResponse.json({
    kind,
    columns: data.columns ?? [],
    results: data.results ?? [],
  });
}
