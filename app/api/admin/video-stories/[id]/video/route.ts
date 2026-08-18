import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { assignAssets, planScenes } from "@/lib/video-stories/scenes";
import { listAssetsByTag } from "@/lib/video-stories/storage";
import type { VisualTag } from "@/lib/video-stories/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Scene planning is pure computation now; the render happens in the worker.
export const maxDuration = 60;

const VIDEO_READY_STATUSES = new Set(["audio_ready", "video_ready", "error"]);

/**
 * POST /api/admin/video-stories/[id]/video
 *
 * Plans the scenes, assigns b-roll from the assets bucket (never the same clip
 * twice in a row), and queues the render for the local worker.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const { data: current } = await admin
    .from("video_stories")
    .select("status, script, cta, genre, audio_path")
    .eq("id", id)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = current as {
    status: string;
    script: string | null;
    cta: string | null;
    genre: string;
    audio_path: string | null;
  };

  if (!VIDEO_READY_STATUSES.has(row.status) || !row.audio_path) {
    return NextResponse.json(
      { error: "Primero genera el audio de la historia." },
      { status: 400 }
    );
  }

  const fullText = [row.script ?? "", row.cta ?? ""].filter(Boolean).join("\n\n");
  // Vertical is the primary cut; the horizontal library is selected the same
  // way when the YouTube render is added.
  const assetsByTag = await listAssetsByTag(admin, "vertical");

  // Rotate only through categories that actually have footage, so an empty
  // folder doesn't waste a slot in the rotation.
  const stocked = (Object.keys(assetsByTag) as VisualTag[]).filter(
    (tag) => assetsByTag[tag].length > 0
  );

  const scenes = planScenes(fullText, stocked);
  const withAssets = assignAssets(scenes, assetsByTag);

  const missingAssets = withAssets.filter((s) => !s.asset).length;
  if (missingAssets === withAssets.length) {
    return NextResponse.json(
      {
        error:
          "El bucket video-story-assets está vacío. Sube clips verticales en carpetas por categoría (vertical/unboxing/, vertical/cocina/, …) antes de generar el video.",
      },
      { status: 400 }
    );
  }

  const { data: job, error } = await admin
    .from("video_story_jobs")
    .insert({
      story_id: id,
      kind: "video",
      status: "queued",
      payload: { scene_count: withAssets.length },
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya hay un video en cola o generándose para esta historia." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin
    .from("video_stories")
    .update({ status: "generating_video", scenes_json: withAssets, error_message: null })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    job_id: (job as { id: string }).id,
    scenes: withAssets.length,
    scenes_without_asset: missingAssets,
  });
}
