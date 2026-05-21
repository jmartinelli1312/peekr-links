import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Reply nested under a top-level review. Same shape as ReviewItem but
// without the rating (replies don't carry a title rating).
export type ReplyItem = {
  id: number;
  parent_id: number;
  comment: string;
  created_at: string;
  like_count: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
};

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
  replies: ReplyItem[];
};

type RawComment = {
  id: number;
  user_id: string;
  comment: string;
  created_at: string;
  like_count: number;
  parent_id: number | null;
};

type RawProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type RawActivity = {
  user_id: string;
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

  // 1. Top-level reviews (parent_id IS NULL). We fetch these first, ordered
  //    by like_count then date — same as before. Up to 100.
  const { data: tops, error: topsErr } = await supabase
    .from("comments")
    .select("id, user_id, comment, created_at, like_count, parent_id")
    .eq("tmdb_id", tmdb_id)
    .is("parent_id", null)
    .not("comment", "is", null)
    .neq("comment", "")
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (topsErr) {
    return NextResponse.json({ error: topsErr.message }, { status: 500 });
  }
  if (!tops || tops.length === 0) {
    return NextResponse.json({ reviews: [], total: 0 });
  }

  const topRows = tops as RawComment[];
  const topIds = topRows.map((r) => r.id);

  // 2. Replies for these top-level reviews (one round trip).
  const { data: replyRows } = await supabase
    .from("comments")
    .select("id, user_id, comment, created_at, like_count, parent_id")
    .in("parent_id", topIds)
    .not("comment", "is", null)
    .neq("comment", "")
    .order("created_at", { ascending: true });

  const replies = (replyRows ?? []) as RawComment[];

  // 3. Profiles for everyone (top + replies) in batch.
  const userIds = [
    ...new Set([
      ...topRows.map((r) => r.user_id),
      ...replies.map((r) => r.user_id),
    ]),
  ];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map<string, RawProfile>(
    (profiles as RawProfile[] ?? []).map((p) => [p.id, p])
  );

  // 4. Ratings by user_id+tmdb_id — only relevant for top-level reviewers.
  const ratingMap = new Map<string, number>();
  const topUserIds = [...new Set(topRows.map((r) => r.user_id))];
  if (topUserIds.length > 0) {
    const { data: activities } = await supabase
      .from("user_title_activities")
      .select("user_id, rating, media_type")
      .in("user_id", topUserIds)
      .eq("tmdb_id", tmdb_id)
      .not("rating", "is", null);

    for (const a of (activities as RawActivity[] ?? [])) {
      if (a.rating !== null && (!a.media_type || a.media_type === type)) {
        ratingMap.set(a.user_id, a.rating);
      }
    }
  }

  // 5. Creator badge for everyone.
  const { data: creators } = await supabase
    .from("approved_creators")
    .select("id")
    .in("id", userIds);

  const creatorSet = new Set((creators ?? []).map((c: { id: string }) => c.id));

  // 6. Group replies under their parent.
  const repliesByParent = new Map<number, ReplyItem[]>();
  for (const r of replies) {
    if (r.parent_id == null) continue;
    const profile = profileMap.get(r.user_id);
    const item: ReplyItem = {
      id: r.id,
      parent_id: r.parent_id,
      comment: r.comment,
      created_at: r.created_at,
      like_count: r.like_count ?? 0,
      username: profile?.username ?? "usuario",
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      is_creator: creatorSet.has(r.user_id),
    };
    const arr = repliesByParent.get(r.parent_id) ?? [];
    arr.push(item);
    repliesByParent.set(r.parent_id, arr);
  }

  // 7. Assemble top-level reviews with their replies.
  const reviews: ReviewItem[] = topRows.map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      id: row.id,
      comment: row.comment,
      created_at: row.created_at,
      like_count: row.like_count ?? 0,
      rating: ratingMap.get(row.user_id) ?? null,
      username: profile?.username ?? "usuario",
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      is_creator: creatorSet.has(row.user_id),
      replies: repliesByParent.get(row.id) ?? [],
    };
  });

  return NextResponse.json(
    { reviews, total: reviews.length },
    {
      headers: {
        // Lower cache TTL because the modal now drives writes — stale
        // data for new posts is more visible than before.
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
      },
    }
  );
}
