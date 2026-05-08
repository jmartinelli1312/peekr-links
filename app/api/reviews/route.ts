import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export type ReviewItem = {
  id: number;
  comment: string;
  created_at: string;
  like_count: number;
  rating: number | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
};

type RawComment = {
  id: number;
  user_id: string;
  comment: string;
  created_at: string;
  like_count: number;
  activity_id: number | null;
};

type RawProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type RawActivity = {
  id: number;
  rating: number | null;
  media_type: string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tmdb_id = Number(searchParams.get("tmdb_id"));
  const type = searchParams.get("type") || "movie";

  if (!tmdb_id || isNaN(tmdb_id)) {
    return NextResponse.json({ error: "Missing tmdb_id" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 1. Fetch comments for this title
  const { data: comments, error: commentsError } = await supabase
    .from("comments")
    .select("id, user_id, comment, created_at, like_count, activity_id")
    .eq("tmdb_id", tmdb_id)
    .not("comment", "is", null)
    .neq("comment", "")
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (commentsError) {
    return NextResponse.json({ error: commentsError.message }, { status: 500 });
  }
  if (!comments || comments.length === 0) {
    return NextResponse.json({ reviews: [], total: 0 });
  }

  const rows = comments as RawComment[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const activityIds = rows
    .map((r) => r.activity_id)
    .filter((id): id is number => id !== null);

  // 2. Fetch profiles in batch
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map<string, RawProfile>(
    (profiles as RawProfile[] ?? []).map((p) => [p.id, p])
  );

  // 3. Fetch activities for rating (only those with activity_id)
  let activityMap = new Map<number, RawActivity>();
  if (activityIds.length > 0) {
    const { data: activities } = await supabase
      .from("user_title_activities")
      .select("id, rating, media_type")
      .in("id", activityIds);

    activityMap = new Map<number, RawActivity>(
      (activities as RawActivity[] ?? []).map((a) => [a.id, a])
    );
  }

  // 4. Fetch creators for badge
  const { data: creators } = await supabase
    .from("approved_creators")
    .select("user_id")
    .in("user_id", userIds);

  const creatorSet = new Set((creators ?? []).map((c: { user_id: string }) => c.user_id));

  // 5. Assemble reviews
  const reviews: ReviewItem[] = rows
    .map((row) => {
      const profile = profileMap.get(row.user_id);
      const activity = row.activity_id ? activityMap.get(row.activity_id) : null;

      // If activity linked, skip if media_type doesn't match
      if (activity?.media_type && activity.media_type !== type) return null;

      return {
        id: row.id,
        comment: row.comment,
        created_at: row.created_at,
        like_count: row.like_count ?? 0,
        rating: activity?.rating ?? null,
        username: profile?.username ?? "usuario",
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        is_creator: creatorSet.has(row.user_id),
      };
    })
    .filter((r): r is ReviewItem => r !== null);

  return NextResponse.json(
    { reviews, total: reviews.length },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
