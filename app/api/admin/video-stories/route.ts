import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { FILTER_STATUSES, type StoryFilter } from "@/lib/video-stories/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIST_COLUMNS =
  "id, internal_title, youtube_title, genre, status, scheduled_for, word_count, estimated_minutes, generated_at, error_message, youtube_video_id, published_at";

/**
 * GET /api/admin/video-stories?filter=pendientes|produccion|publicadas
 *
 * The three filters map onto status groups (see FILTER_STATUSES); omitting the
 * parameter returns every story.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const filter = req.nextUrl.searchParams.get("filter") as StoryFilter | null;

  let query = admin
    .from("video_stories")
    .select(LIST_COLUMNS)
    .order("generated_at", { ascending: false })
    .limit(100);

  if (filter && filter in FILTER_STATUSES) {
    query = query.in("status", FILTER_STATUSES[filter]);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Counts for the filter pills, so the tab can show how much is waiting.
  const counts: Record<string, number> = {};
  await Promise.all(
    (Object.keys(FILTER_STATUSES) as StoryFilter[]).map(async (key) => {
      const { count } = await admin
        .from("video_stories")
        .select("id", { count: "exact", head: true })
        .in("status", FILTER_STATUSES[key]);
      counts[key] = count ?? 0;
    })
  );

  return NextResponse.json({ stories: data ?? [], counts });
}
