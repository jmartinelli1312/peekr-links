import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/peekrbuzz/trigger-select
 *
 * Admin-only manual trigger for the daily candidate selection cron. Used by
 * the dashboard's "Regenerar" button when an editor wants to refresh today's
 * candidates outside of the regular 09:00 UTC schedule.
 *
 * Query params:
 *   ?date=YYYY-MM-DD   target a specific date (default: today in Argentina)
 *   ?force=1           overwrite existing candidates if any
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const search = new URLSearchParams();
  const date = url.searchParams.get("date");
  const force = url.searchParams.get("force");
  if (date) search.set("date", date);
  if (force) search.set("force", force);

  const origin = url.origin;
  const targetUrl = `${origin}/api/cron/select-daily-peekrbuzz${search.toString() ? `?${search.toString()}` : ""}`;

  const res = await fetch(targetUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
