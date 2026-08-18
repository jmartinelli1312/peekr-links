import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { loadSettings } from "@/lib/video-stories/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const settings = await loadSettings(auth.admin);
  return NextResponse.json({ settings });
}

/**
 * PATCH /api/admin/video-stories/settings
 *
 * The schedule (which days, what hour, which timezone) and the length targets
 * live here rather than in vercel.json, so changing the publishing hour is a
 * form field instead of a deploy.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if (typeof body.schedule_enabled === "boolean") {
    update.schedule_enabled = body.schedule_enabled;
  }

  if (typeof body.schedule_timezone === "string" && body.schedule_timezone.trim()) {
    const tz = body.schedule_timezone.trim();
    // Reject an unknown zone here rather than letting the cron silently fall
    // back to UTC and generate at the wrong hour.
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      return NextResponse.json({ error: `Zona horaria inválida: ${tz}` }, { status: 400 });
    }
    update.schedule_timezone = tz;
  }

  if (typeof body.schedule_hour === "number") {
    const hour = Math.floor(body.schedule_hour);
    if (hour < 0 || hour > 23) {
      return NextResponse.json({ error: "schedule_hour debe estar entre 0 y 23" }, { status: 400 });
    }
    update.schedule_hour = hour;
  }

  if (Array.isArray(body.schedule_days)) {
    const days = Array.from(
      new Set(body.schedule_days.map((d) => Math.floor(Number(d))).filter((d) => d >= 1 && d <= 7))
    ).sort();
    if (days.length === 0) {
      return NextResponse.json(
        { error: "Elige al menos un día (1 = lunes … 7 = domingo)" },
        { status: 400 }
      );
    }
    update.schedule_days = days;
  }

  for (const key of ["target_min_minutes", "target_max_minutes", "playback_speed"] as const) {
    if (typeof body[key] === "number" && Number.isFinite(body[key] as number)) {
      update[key] = body[key];
    }
  }

  if (typeof body.words_per_minute === "number" && body.words_per_minute > 0) {
    update.words_per_minute = Math.round(body.words_per_minute);
  }
  if (typeof body.voice_style === "string" && body.voice_style.trim()) {
    update.voice_style = body.voice_style.trim().slice(0, 1000);
  }
  if (typeof body.default_voice_id === "string" && body.default_voice_id.trim()) {
    update.default_voice_id = body.default_voice_id.trim().slice(0, 64);
  }
  if (
    typeof body.default_visibility === "string" &&
    ["private", "unlisted", "public"].includes(body.default_visibility)
  ) {
    update.default_visibility = body.default_visibility;
  }

  const min = (update.target_min_minutes as number) ?? null;
  const max = (update.target_max_minutes as number) ?? null;
  if (min !== null && max !== null && min > max) {
    return NextResponse.json(
      { error: "La duración mínima no puede ser mayor que la máxima" },
      { status: 400 }
    );
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("video_story_settings")
    .update(update)
    .eq("id", 1)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
