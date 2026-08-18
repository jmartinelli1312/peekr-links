import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { OUTPUT_BUCKET, signedUrl } from "@/lib/video-stories/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/video-stories/[id]/media
 *
 * Mints short-lived signed URLs for the narration and the rendered video so
 * the editor can play and download them. The bucket is private, so these URLs
 * are the only way in — they expire in an hour and are never persisted.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const { data } = await admin
    .from("video_stories")
    .select("audio_path, video_path")
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = data as { audio_path: string | null; video_path: string | null };

  const [audio, video] = await Promise.all([
    row.audio_path ? signedUrl(admin, OUTPUT_BUCKET, row.audio_path) : Promise.resolve(null),
    row.video_path ? signedUrl(admin, OUTPUT_BUCKET, row.video_path) : Promise.resolve(null),
  ]);

  return NextResponse.json({ audio_url: audio, video_url: video });
}
