import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireWorker } from "@/lib/video-stories/worker-auth";
import { loadSettings } from "@/lib/video-stories/generate";
import { chunkForSynthesis, getTtsProvider } from "@/lib/video-stories/tts/provider";
import {
  ASSETS_BUCKET,
  OUTPUT_BUCKET,
  audioPath,
  signedUrl,
  subtitlesPath,
  videoPath,
} from "@/lib/video-stories/storage";
import type { Scene } from "@/lib/video-stories/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Output format. Vertical is the primary cut (TikTok, where this format
 * spreads); a horizontal YouTube cut can be added later by sending different
 * numbers here — the worker reads them from the payload.
 */
const OUTPUT = { width: 1080, height: 1920 };

/**
 * Optional branding and music, looked up by convention in the assets bucket.
 * Intro and outro live under an orientation folder because a 16:9 card
 * cropped to vertical loses its sides.
 */
const BRANDING = {
  intro: "branding/vertical/intro.mp4",
  outro: "branding/vertical/outro.mp4",
  logo: "branding/logo.png",
};
const MUSIC_PREFIX = "musica";

const RENDER_TTL_SECONDS = 6 * 60 * 60;

/**
 * A job claimed this long ago without reporting back is assumed dead (worker
 * crashed, laptop slept, process killed). Requeueing it matters because the
 * partial unique index treats a stuck 'running' row as a live job, which would
 * otherwise block every retry for that story forever.
 */
const STALE_JOB_MINUTES = 120;

async function requeueStaleJobs(admin: ReturnType<typeof getSupabaseAdmin>) {
  const cutoff = new Date(Date.now() - STALE_JOB_MINUTES * 60_000).toISOString();
  await admin
    .from("video_story_jobs")
    .update({ status: "queued", started_at: null })
    .eq("status", "running")
    .lt("started_at", cutoff);
}

/**
 * GET /api/admin/video-stories/jobs
 *
 * Claims the oldest queued job and returns everything the worker needs to run
 * it — signed read URLs for inputs, a signed upload URL for the output. The
 * worker never receives the Supabase service key, the Gemini key, or any
 * YouTube token.
 *
 * Returns 204 when the queue is empty.
 */
export async function GET(req: NextRequest) {
  const denied = requireWorker(req);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  await requeueStaleJobs(admin);

  const { data: queued } = await admin
    .from("video_story_jobs")
    .select("id, story_id, kind, payload, attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!queued) return new NextResponse(null, { status: 204 });

  const job = queued as {
    id: string;
    story_id: string;
    kind: "audio" | "video";
    payload: Record<string, unknown>;
    attempts: number;
  };

  // Conditional update doubles as the claim: if another worker got there
  // first, no rows come back and we report an empty queue.
  const { data: claimed } = await admin
    .from("video_story_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempts: job.attempts + 1,
    })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();

  if (!claimed) return new NextResponse(null, { status: 204 });

  const { data: storyRow } = await admin
    .from("video_stories")
    .select("id, internal_title, script, cta, voice_id, voice_speed, scenes_json, audio_path")
    .eq("id", job.story_id)
    .maybeSingle();

  if (!storyRow) {
    await admin
      .from("video_story_jobs")
      .update({
        status: "error",
        error_message: "La historia ya no existe",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return new NextResponse(null, { status: 204 });
  }

  const story = storyRow as {
    id: string;
    internal_title: string;
    script: string | null;
    cta: string | null;
    voice_id: string | null;
    voice_speed: number;
    scenes_json: Scene[] | null;
    audio_path: string | null;
  };

  // Everything below runs on an already-claimed job. If building the payload
  // throws (missing key, storage hiccup), the job must not be left 'running' —
  // that would block every retry for this story until the stale sweep.
  try {
    return await buildJobPayload(admin, job, story);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await Promise.all([
      admin
        .from("video_story_jobs")
        .update({
          status: "error",
          error_message: message.slice(0, 1000),
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id),
      admin
        .from("video_stories")
        .update({ status: "error", error_message: message.slice(0, 1000) })
        .eq("id", story.id),
    ]);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface ClaimedJob {
  id: string;
  kind: "audio" | "video";
  payload: Record<string, unknown>;
}

interface StoryForJob {
  id: string;
  internal_title: string;
  script: string | null;
  cta: string | null;
  voice_id: string | null;
  voice_speed: number;
  scenes_json: Scene[] | null;
  audio_path: string | null;
}

async function buildJobPayload(
  admin: ReturnType<typeof getSupabaseAdmin>,
  job: ClaimedJob,
  story: StoryForJob
): Promise<NextResponse> {
  if (job.kind === "audio") {
    const provider = await getTtsProvider();
    const settings = await loadSettings(admin);
    const fullText = [story.script ?? "", story.cta ?? ""].filter(Boolean).join("\n\n");
    const chunks = chunkForSynthesis(fullText, provider.maxCharsPerRequest);

    const [{ data: upload }, { data: subsUpload }] = await Promise.all([
      admin.storage.from(OUTPUT_BUCKET).createSignedUploadUrl(audioPath(story.id), {
        upsert: true,
      }),
      admin.storage.from(OUTPUT_BUCKET).createSignedUploadUrl(subtitlesPath(story.id), {
        upsert: true,
      }),
    ]);

    return NextResponse.json({
      job_id: job.id,
      kind: "audio",
      story_id: story.id,
      story_title: story.internal_title,
      voice_id: (job.payload.voice_id as string) || story.voice_id,
      // Persona from settings, so every chunk and every story is read by the
      // same narrator. A per-job override still wins if one was passed.
      style: (job.payload.style as string) || settings.voice_style || null,
      speed: story.voice_speed,
      chunks,
      output_path: audioPath(story.id),
      upload_url: upload?.signedUrl ?? null,
      upload_token: upload?.token ?? null,
      // Caption timings are derived while synthesising, when the exact length
      // of every chunk is known.
      subtitles_upload_url: subsUpload?.signedUrl ?? null,
    });
  }

  // ── video ──────────────────────────────────────────────────────────────────
  const scenes = story.scenes_json ?? [];

  const sceneUrls = await Promise.all(
    scenes.map(async (scene) => ({
      index: scene.index,
      tag: scene.tag,
      words: scene.text.trim().split(/\s+/).filter(Boolean).length,
      asset_url: scene.asset
        ? await signedUrl(admin, ASSETS_BUCKET, scene.asset, RENDER_TTL_SECONDS)
        : null,
    }))
  );

  const { data: musicList } = await admin.storage.from(ASSETS_BUCKET).list(MUSIC_PREFIX, {
    limit: 20,
  });
  const musicFile = (musicList ?? []).find((entry) => entry.id && /\.(mp3|m4a|wav|aac)$/i.test(entry.name));

  const [audioUrl, subtitlesUrl, introUrl, outroUrl, logoUrl, musicUrl, upload] = await Promise.all([
    story.audio_path
      ? signedUrl(admin, OUTPUT_BUCKET, story.audio_path, RENDER_TTL_SECONDS)
      : Promise.resolve(null),
    signedUrl(admin, OUTPUT_BUCKET, subtitlesPath(story.id), RENDER_TTL_SECONDS),
    signedUrl(admin, ASSETS_BUCKET, BRANDING.intro, RENDER_TTL_SECONDS),
    signedUrl(admin, ASSETS_BUCKET, BRANDING.outro, RENDER_TTL_SECONDS),
    signedUrl(admin, ASSETS_BUCKET, BRANDING.logo, RENDER_TTL_SECONDS),
    musicFile
      ? signedUrl(admin, ASSETS_BUCKET, `${MUSIC_PREFIX}/${musicFile.name}`, RENDER_TTL_SECONDS)
      : Promise.resolve(null),
    admin.storage.from(OUTPUT_BUCKET).createSignedUploadUrl(videoPath(story.id), { upsert: true }),
  ]);

  return NextResponse.json({
    job_id: job.id,
    kind: "video",
    story_id: story.id,
    story_title: story.internal_title,
    audio_url: audioUrl,
    // Null when the audio job predates subtitles; the worker just skips them.
    subtitles_url: subtitlesUrl,
    width: OUTPUT.width,
    height: OUTPUT.height,
    // B-roll plays at the same speed as the narration so the cut feels tight.
    clip_speed: story.voice_speed,
    scenes: sceneUrls,
    branding: { intro_url: introUrl, outro_url: outroUrl, logo_url: logoUrl },
    music_url: musicUrl,
    output_path: videoPath(story.id),
    upload_url: upload.data?.signedUrl ?? null,
    upload_token: upload.data?.token ?? null,
  });
}

/**
 * POST /api/admin/video-stories/jobs
 *
 * Body: { job_id, status: "done" | "error", error_message?, duration_seconds? }
 *
 * The worker has already uploaded its output via the signed URL; this call
 * closes the job and advances the story's status.
 */
export async function POST(req: NextRequest) {
  const denied = requireWorker(req);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const jobId = typeof body.job_id === "string" ? body.job_id : null;
  const status = body.status === "done" ? "done" : body.status === "error" ? "error" : null;

  if (!jobId || !status) {
    return NextResponse.json({ error: "job_id y status son obligatorios" }, { status: 400 });
  }

  const { data: jobRow } = await admin
    .from("video_story_jobs")
    .select("id, story_id, kind")
    .eq("id", jobId)
    .maybeSingle();

  if (!jobRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = jobRow as { id: string; story_id: string; kind: "audio" | "video" };
  const errorMessage =
    typeof body.error_message === "string" ? body.error_message.slice(0, 1000) : null;

  await admin
    .from("video_story_jobs")
    .update({
      status,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
      result: status === "done" ? { duration_seconds: body.duration_seconds ?? null } : null,
    })
    .eq("id", jobId);

  const duration =
    typeof body.duration_seconds === "number" && Number.isFinite(body.duration_seconds)
      ? Math.round(body.duration_seconds * 100) / 100
      : null;

  if (status === "error") {
    await admin
      .from("video_stories")
      .update({ status: "error", error_message: errorMessage })
      .eq("id", job.story_id);
  } else if (job.kind === "audio") {
    await admin
      .from("video_stories")
      .update({
        status: "audio_ready",
        audio_path: audioPath(job.story_id),
        audio_duration_seconds: duration,
        error_message: null,
      })
      .eq("id", job.story_id);
  } else {
    await admin
      .from("video_stories")
      .update({
        status: "video_ready",
        video_path: videoPath(job.story_id),
        video_duration_seconds: duration,
        error_message: null,
      })
      .eq("id", job.story_id);
  }

  return NextResponse.json({ ok: true });
}
