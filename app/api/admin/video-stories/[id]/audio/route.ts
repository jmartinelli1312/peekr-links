import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { loadSettings } from "@/lib/video-stories/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Statuses from which starting (or restarting) narration makes sense. */
const AUDIO_READY_STATUSES = new Set(["approved", "audio_ready", "video_ready", "error"]);

/**
 * POST /api/admin/video-stories/[id]/audio
 *
 * Body: { voice_id?: string, style?: string }
 *
 * Queues narration for the local worker. Synthesising ~5.000 words takes far
 * longer than a Vercel function may run, so this route only enqueues; the
 * worker drains the queue and writes the result back.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { voice_id?: unknown; style?: unknown };

  const { data: current } = await admin
    .from("video_stories")
    .select("status, script, cta, voice_id, voice_speed")
    .eq("id", id)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = current as {
    status: string;
    script: string | null;
    cta: string | null;
    voice_id: string | null;
    voice_speed: number;
  };

  if (!AUDIO_READY_STATUSES.has(row.status)) {
    return NextResponse.json(
      { error: `Primero aprueba la historia (estado actual: ${row.status}).` },
      { status: 400 }
    );
  }
  if (!row.script?.trim()) {
    return NextResponse.json({ error: "La historia no tiene guion." }, { status: 400 });
  }

  const settings = await loadSettings(admin);
  const voiceId =
    (typeof body.voice_id === "string" && body.voice_id.trim()) ||
    row.voice_id ||
    settings.default_voice_id;

  // The partial unique index on (story_id, kind) rejects a second live job,
  // which is exactly the double-click guard we want — report it as a conflict.
  const { data: job, error } = await admin
    .from("video_story_jobs")
    .insert({
      story_id: id,
      kind: "audio",
      status: "queued",
      payload: {
        voice_id: voiceId,
        style: typeof body.style === "string" ? body.style.slice(0, 300) : null,
      },
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya hay un audio en cola o generándose para esta historia." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin
    .from("video_stories")
    .update({ status: "generating_audio", voice_id: voiceId, error_message: null })
    .eq("id", id);

  return NextResponse.json({ ok: true, job_id: (job as { id: string }).id });
}
