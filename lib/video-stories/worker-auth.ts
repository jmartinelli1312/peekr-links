/**
 * Shared-secret auth for the local render worker.
 *
 * The worker runs outside Vercel (it needs FFmpeg and minutes of CPU), so it
 * cannot use a Supabase admin session. It authenticates with a dedicated
 * secret instead — one that grants access only to the job queue and the TTS
 * relay, never to the Supabase service role or the YouTube tokens.
 */

import { NextRequest, NextResponse } from "next/server";

export function requireWorker(req: NextRequest): NextResponse | null {
  const secret = process.env.VIDEO_STORY_WORKER_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "VIDEO_STORY_WORKER_SECRET no está configurada" },
      { status: 500 }
    );
  }

  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Length-independent comparison: bail before timingSafeEqual, which throws
  // on mismatched buffer lengths.
  if (provided.length !== secret.length || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
