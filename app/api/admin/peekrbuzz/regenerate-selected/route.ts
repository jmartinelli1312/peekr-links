import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { todayInArgentina } from "@/lib/peekrbuzz-daily/argentina";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/peekrbuzz/regenerate-selected
 *
 * Body: { candidate_ids: [<id>, ...], target_date?: "YYYY-MM-DD" }
 *
 * Replaces the chosen daily_candidate rows with fresh ones:
 *   1. Marks each candidate's source signal as 'rejected' so future runs
 *      never resurface it.
 *   2. Deletes the candidate rows themselves.
 *   3. Invokes the select-daily cron in fill-mode — it tops the candidate
 *      pool back up to 4, skipping signals that are already represented.
 *
 * The editor can keep some candidates and only refresh the rest: only the
 * IDs they pass here get replaced.
 */
export async function POST(req: NextRequest) {
  // ── Auth (admin) ────────────────────────────────────────────────────────────
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

  // ── Parse body ──────────────────────────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as { candidate_ids?: unknown; target_date?: string };
  const ids = Array.isArray(body.candidate_ids) ? body.candidate_ids : [];
  const candidateIds = ids
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (candidateIds.length === 0) {
    return NextResponse.json({ error: "candidate_ids must be a non-empty array" }, { status: 400 });
  }

  const targetDate = body.target_date && /^\d{4}-\d{2}-\d{2}$/.test(body.target_date)
    ? body.target_date
    : todayInArgentina();

  // ── 1. Fetch the rss_signal_id for each candidate we're about to drop ──────
  const { data: candidates, error: fetchErr } = await admin
    .from("peekrbuzz_articles")
    .select("id, rss_signal_id")
    .in("id", candidateIds)
    .eq("candidate_for_date", targetDate)
    .eq("article_status", "daily_candidate")
    .eq("language", "es");

  if (fetchErr) {
    return NextResponse.json({ error: `fetch candidates: ${fetchErr.message}` }, { status: 500 });
  }

  const signalIdsToReject = ((candidates ?? []) as Array<{ rss_signal_id: number | null }>)
    .map((c) => c.rss_signal_id)
    .filter((id): id is number => typeof id === "number");

  // ── 2. Reject the source signals (article_status='rejected' on those rows) ─
  // Future scoring runs filter by article_status='signal', so rejected signals
  // are permanently excluded from the candidate pool.
  let signalsRejected = 0;
  if (signalIdsToReject.length > 0) {
    const { count: rejCount } = await admin
      .from("peekrbuzz_articles")
      .update(
        { article_status: "rejected", review_status: "rejected" },
        { count: "exact" },
      )
      .in("id", signalIdsToReject)
      .eq("article_status", "signal");
    signalsRejected = rejCount ?? 0;
  }

  // ── 3. Delete the candidate rows themselves so fill-mode can refill ────────
  const { count: deletedCount, error: deleteErr } = await admin
    .from("peekrbuzz_articles")
    .delete({ count: "exact" })
    .in("id", candidateIds)
    .eq("candidate_for_date", targetDate)
    .eq("article_status", "daily_candidate")
    .eq("language", "es");

  if (deleteErr) {
    return NextResponse.json({ error: `delete candidates: ${deleteErr.message}` }, { status: 500 });
  }

  // ── 4. Trigger the daily-select cron in fill-mode (no force flag — we want
  //       it to top up to TARGET_DAILY_CANDIDATES, not wipe surviving rows) ──
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const cronRes = await fetch(`${origin}/api/cron/select-daily-peekrbuzz?date=${targetDate}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const cronData = await cronRes.json().catch(() => ({}));

  return NextResponse.json({
    ok: cronRes.ok,
    target_date: targetDate,
    candidates_deleted: deletedCount ?? 0,
    signals_rejected: signalsRejected,
    refill: cronData,
  });
}
