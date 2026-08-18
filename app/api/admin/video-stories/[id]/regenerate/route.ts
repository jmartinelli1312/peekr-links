import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import {
  generateStoryContent,
  loadSettings,
  statusFromReview,
} from "@/lib/video-stories/generate";
import { GENRES, type Genre } from "@/lib/video-stories/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOCKED_STATUSES = new Set([
  "approved",
  "generating_audio",
  "audio_ready",
  "generating_video",
  "video_ready",
  "published",
]);

/**
 * POST /api/admin/video-stories/[id]/regenerate
 *
 * Body: { genre?: Genre, confirm_overwrite?: boolean }
 *
 * Replaces the story's text in place, keeping the row (and therefore any link
 * already shared internally). Regenerating over an approved story requires
 * `confirm_overwrite: true` and resets it to Pendiente.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    genre?: unknown;
    confirm_overwrite?: unknown;
  };

  const { data: current } = await admin
    .from("video_stories")
    .select("id, genre, status")
    .eq("id", id)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = current as { genre: string; status: string };

  if (LOCKED_STATUSES.has(row.status) && body.confirm_overwrite !== true) {
    return NextResponse.json(
      {
        error: "locked",
        message:
          "Esta historia ya fue aprobada. Confirma que quieres regenerarla: se perderá el texto actual y volverá al estado Pendiente.",
        status: row.status,
      },
      { status: 409 }
    );
  }

  const genre =
    typeof body.genre === "string" && (GENRES as readonly string[]).includes(body.genre)
      ? (body.genre as Genre)
      : (row.genre as Genre);

  const settings = await loadSettings(admin);

  try {
    const result = await generateStoryContent(genre, settings);

    const { data, error } = await admin
      .from("video_stories")
      .update({
        internal_title: result.premise.internal_title,
        youtube_title: result.premise.youtube_title,
        genre,
        premise: result.premise.premise,
        hook: result.premise.hook,
        midpoint_twist: result.premise.midpoint_twist,
        ending: result.premise.ending,
        script: result.script,
        cta: result.cta,
        word_count: result.wordCount,
        estimated_minutes: result.estimatedMinutes,
        review_json: result.review,
        status: statusFromReview(result.review),
        error_message: null,
        generated_at: new Date().toISOString(),
        // The new text has not been approved, and any previously rendered
        // media no longer matches it.
        approved_at: null,
        approved_by: null,
        audio_path: null,
        audio_duration_seconds: null,
        video_path: null,
        video_duration_seconds: null,
        scenes_json: null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, story: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("video_stories")
      .update({ status: "error", error_message: message.slice(0, 1000) })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
