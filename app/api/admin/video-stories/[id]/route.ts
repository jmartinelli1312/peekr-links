import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { loadSettings } from "@/lib/video-stories/generate";
import { countWords, estimateMinutes, GENRES, type Genre } from "@/lib/video-stories/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Statuses past approval — editing these needs an explicit confirmation. */
const LOCKED_STATUSES = new Set([
  "approved",
  "generating_audio",
  "audio_ready",
  "generating_video",
  "video_ready",
  "published",
]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(_req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const [{ data: story, error }, { data: jobs }] = await Promise.all([
    admin.from("video_stories").select("*").eq("id", id).maybeSingle(),
    admin
      .from("video_story_jobs")
      .select("id, kind, status, error_message, attempts, created_at, finished_at")
      .eq("story_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ story, jobs: jobs ?? [] });
}

/**
 * PATCH /api/admin/video-stories/[id]
 *
 * Body: { internal_title?, youtube_title?, genre?, script?, cta?,
 *         youtube_description?, voice_id?, voice_speed?, confirm_overwrite? }
 *
 * An approved story is not silently overwritten: without
 * `confirm_overwrite: true` the request is rejected with 409 so the UI can ask
 * first. Editing an approved story also sends it back to 'pending', because
 * the approval applied to the previous text.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const { data: current } = await admin
    .from("video_stories")
    .select("status, script, cta")
    .eq("id", id)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const currentStatus = (current as { status: string }).status;
  const editsContent =
    typeof body.script === "string" ||
    typeof body.cta === "string" ||
    typeof body.genre === "string";

  if (editsContent && LOCKED_STATUSES.has(currentStatus) && body.confirm_overwrite !== true) {
    return NextResponse.json(
      {
        error: "locked",
        message:
          "Esta historia ya fue aprobada. Confirma que quieres sobrescribirla: volverá al estado Pendiente y habrá que aprobarla de nuevo.",
        status: currentStatus,
      },
      { status: 409 }
    );
  }

  const update: Record<string, unknown> = {};

  if (typeof body.internal_title === "string" && body.internal_title.trim()) {
    update.internal_title = body.internal_title.trim().slice(0, 200);
  }
  if (typeof body.youtube_title === "string") {
    update.youtube_title = body.youtube_title.trim().slice(0, 100);
  }
  if (typeof body.youtube_description === "string") {
    update.youtube_description = body.youtube_description.slice(0, 5000);
  }
  if (typeof body.genre === "string" && (GENRES as readonly string[]).includes(body.genre)) {
    update.genre = body.genre as Genre;
  }
  if (typeof body.voice_id === "string" && body.voice_id.trim()) {
    update.voice_id = body.voice_id.trim().slice(0, 64);
  }
  if (typeof body.voice_speed === "number" && body.voice_speed >= 0.5 && body.voice_speed <= 3) {
    update.voice_speed = body.voice_speed;
  }

  if (typeof body.script === "string" || typeof body.cta === "string") {
    const script = typeof body.script === "string" ? body.script : (current as { script: string | null }).script ?? "";
    const cta = typeof body.cta === "string" ? body.cta : (current as { cta: string | null }).cta ?? "";

    if (typeof body.script === "string") update.script = script;
    if (typeof body.cta === "string") update.cta = cta;

    const settings = await loadSettings(admin);
    const wordCount = countWords(script) + countWords(cta);
    update.word_count = wordCount;
    update.estimated_minutes = estimateMinutes(wordCount, settings);
  }

  // A content edit invalidates a previous approval.
  if (editsContent && LOCKED_STATUSES.has(currentStatus)) {
    update.status = "pending";
    update.approved_at = null;
    update.approved_by = null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("video_stories")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ story: data });
}
