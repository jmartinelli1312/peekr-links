import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { buildAuthUrl, YouTubeError } from "@/lib/video-stories/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/video-stories/youtube/connect
 *
 * Returns the Google consent URL. The dashboard opens it in a new tab rather
 * than redirecting, because the admin page authenticates with a Bearer token
 * that a redirect would drop.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ url: buildAuthUrl(auth.userId) });
  } catch (err) {
    const status = err instanceof YouTubeError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status }
    );
  }
}
