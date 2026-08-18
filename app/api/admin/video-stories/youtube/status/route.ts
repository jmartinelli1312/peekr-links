import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/video-stories/youtube/status
 *
 * Reports connection state and the channel name only. Tokens are never part of
 * the response — the dashboard has no reason to see them and no way to use
 * them.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { data } = await auth.admin
    .from("video_story_youtube_connection")
    .select("channel_id, channel_title, connected_at, refresh_token")
    .eq("id", 1)
    .maybeSingle();

  const row = data as {
    channel_id: string | null;
    channel_title: string | null;
    connected_at: string | null;
    refresh_token: string | null;
  } | null;

  return NextResponse.json({
    connected: Boolean(row?.refresh_token),
    channel_id: row?.channel_id ?? null,
    channel_title: row?.channel_title ?? null,
    connected_at: row?.connected_at ?? null,
  });
}

/** POST — disconnects by clearing the stored credentials. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  await auth.admin
    .from("video_story_youtube_connection")
    .update({
      channel_id: null,
      channel_title: null,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      scope: null,
      connected_at: null,
      connected_by: null,
    })
    .eq("id", 1);

  return NextResponse.json({ ok: true, connected: false });
}
