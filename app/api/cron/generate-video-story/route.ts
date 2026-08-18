import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createStory, loadSettings } from "@/lib/video-stories/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/generate-video-story
 *
 * Runs hourly and generates a DRAFT only — never audio, never video, never a
 * publish. It fires when the configured hour arrives in the configured
 * timezone on one of the configured days (default: Monday, Wednesday,
 * Saturday at 09:00 America/Argentina/Buenos_Aires).
 *
 * The hourly cadence is deliberate: it keeps the schedule editable from the
 * dashboard instead of requiring a vercel.json change and a deploy every time
 * the hour moves.
 *
 * Auth: Vercel Cron's injected `Bearer ${CRON_SECRET}`, or the same secret by
 * hand for a manual trigger.
 */
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && auth === `Bearer ${cronSecret}`);
}

/** ISO day-of-week (1 = Monday … 7 = Sunday) and hour in a given timezone. */
function nowInTimezone(timeZone: string): { isoDay: number; hour: number; date: string } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((p) => [p.type, p.value])
  ) as Record<string, string>;

  const weekdayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };

  return {
    isoDay: weekdayMap[parts.weekday] ?? 0,
    hour: Number(parts.hour),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const settings = await loadSettings(admin);

  const force = req.nextUrl.searchParams.get("force") === "1";

  if (!settings.schedule_enabled && !force) {
    return NextResponse.json({ ok: true, skipped: "schedule_disabled" });
  }

  const { isoDay, hour, date } = nowInTimezone(settings.schedule_timezone);

  if (!force) {
    if (!settings.schedule_days.includes(isoDay)) {
      return NextResponse.json({ ok: true, skipped: "not_a_scheduled_day", isoDay });
    }
    if (hour !== settings.schedule_hour) {
      return NextResponse.json({ ok: true, skipped: "not_the_scheduled_hour", hour });
    }
  }

  // Idempotency: the cron runs every hour, and a retry inside the same hour
  // must not produce a second story for the same day.
  const { count } = await admin
    .from("video_stories")
    .select("id", { count: "exact", head: true })
    .eq("scheduled_for", date);

  if ((count ?? 0) > 0 && !force) {
    return NextResponse.json({ ok: true, skipped: "already_generated_today", date });
  }

  try {
    const { id } = await createStory(admin, { scheduledFor: date });
    return NextResponse.json({ ok: true, created: id, date });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
