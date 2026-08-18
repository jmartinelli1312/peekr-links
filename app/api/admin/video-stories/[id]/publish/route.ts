import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { OUTPUT_BUCKET, signedUrl, thumbnailPath } from "@/lib/video-stories/storage";
import {
  getAccessToken,
  setThumbnail,
  uploadVideo,
  YouTubeError,
} from "@/lib/video-stories/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VISIBILITIES = new Set(["private", "unlisted", "public"]);

/**
 * POST /api/admin/video-stories/[id]/publish
 *
 * Body: { confirm: true, visibility?: "private" | "unlisted" | "public" }
 *
 * Publishing is never automatic. This route only runs when an admin has seen
 * the confirmation dialog (channel, title, visibility, duration) and sent
 * `confirm: true`. Visibility defaults to private.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Falta la confirmación explícita para publicar." },
      { status: 400 }
    );
  }

  const { data: storyRow } = await admin
    .from("video_stories")
    .select(
      "id, internal_title, youtube_title, youtube_description, cta, premise, status, video_path, video_duration_seconds, youtube_visibility, genre"
    )
    .eq("id", id)
    .maybeSingle();

  if (!storyRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const story = storyRow as {
    id: string;
    internal_title: string;
    youtube_title: string | null;
    youtube_description: string | null;
    cta: string | null;
    premise: string | null;
    status: string;
    video_path: string | null;
    video_duration_seconds: number | null;
    youtube_visibility: string;
    genre: string;
  };

  if (story.status === "published") {
    return NextResponse.json({ error: "Esta historia ya fue publicada." }, { status: 400 });
  }
  if (story.status !== "video_ready" || !story.video_path) {
    return NextResponse.json(
      { error: "El video todavía no está listo." },
      { status: 400 }
    );
  }

  const visibility =
    typeof body.visibility === "string" && VISIBILITIES.has(body.visibility)
      ? (body.visibility as "private" | "unlisted" | "public")
      : (story.youtube_visibility as "private" | "unlisted" | "public");

  const videoUrl = await signedUrl(admin, OUTPUT_BUCKET, story.video_path, 60 * 60);
  if (!videoUrl) {
    return NextResponse.json({ error: "No se pudo leer el video renderizado." }, { status: 500 });
  }

  try {
    const accessToken = await getAccessToken(admin);

    const description =
      story.youtube_description?.trim() ||
      [story.premise ?? "", "", story.cta ?? ""].filter(Boolean).join("\n\n").trim() ||
      story.internal_title;

    const { videoId } = await uploadVideo({
      accessToken,
      videoUrl,
      title: story.youtube_title?.trim() || story.internal_title,
      description,
      privacyStatus: visibility,
      tags: ["historias", "relatos", story.genre, "peekr"],
    });

    // A thumbnail is optional — a failure here must not undo a successful
    // upload, so it is best-effort and reported separately.
    let thumbnailError: string | null = null;
    const thumbUrl = await signedUrl(admin, OUTPUT_BUCKET, thumbnailPath(id), 60 * 10);
    if (thumbUrl) {
      try {
        await setThumbnail(accessToken, videoId, thumbUrl);
      } catch (err) {
        thumbnailError = err instanceof Error ? err.message : String(err);
      }
    }

    await admin
      .from("video_stories")
      .update({
        status: "published",
        youtube_video_id: videoId,
        youtube_visibility: visibility,
        published_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", id);

    return NextResponse.json({
      ok: true,
      video_id: videoId,
      visibility,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail_error: thumbnailError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof YouTubeError ? err.status : 500;
    await admin
      .from("video_stories")
      .update({ error_message: message.slice(0, 1000) })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 500 });
  }
}
