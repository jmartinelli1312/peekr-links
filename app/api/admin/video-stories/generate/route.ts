import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { createStory, StoryGenerationError } from "@/lib/video-stories/generate";
import { GENRES, type Genre } from "@/lib/video-stories/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Premise + four acts + CTA + review is a chain of six model calls.
export const maxDuration = 300;

/**
 * POST /api/admin/video-stories/generate
 *
 * Body: { genre?: Genre }
 *
 * Produces a draft only — never audio, video, or a publish. Omitting `genre`
 * picks one that wasn't used in the last two stories.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const body = (await req.json().catch(() => ({}))) as { genre?: unknown };
  const genre =
    typeof body.genre === "string" && (GENRES as readonly string[]).includes(body.genre)
      ? (body.genre as Genre)
      : undefined;

  try {
    const { id } = await createStory(admin, { genre });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message =
      err instanceof StoryGenerationError || err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
