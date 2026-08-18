import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { getTtsProvider } from "@/lib/video-stories/tts/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/video-stories/voices — options for the voice picker. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const provider = await getTtsProvider();
    return NextResponse.json({ provider: provider.name, voices: provider.listVoices() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
