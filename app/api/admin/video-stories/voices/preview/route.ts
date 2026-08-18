import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import { getTtsProvider } from "@/lib/video-stories/tts/provider";
import { loadSettings } from "@/lib/video-stories/generate";
import { pcmToWav } from "@/lib/video-stories/wav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Neutral sample line — long enough to judge a voice, short enough to be cheap. */
const SAMPLE_TEXT =
  "Mi hermana me pidió ser la primera en caminar por el pasillo el día de mi boda, y le dije " +
  "que sí. Lo que nunca le aclaré fue a qué estaba accediendo exactamente.";

/**
 * POST /api/admin/video-stories/voices/preview
 *
 * Body: { voice_id: string, style?: string }
 *
 * Returns a WAV sample so the admin can compare voices before committing to a
 * 20-minute narration.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { voice_id?: unknown; style?: unknown };
  const voiceId = typeof body.voice_id === "string" ? body.voice_id.trim() : "";
  if (!voiceId) {
    return NextResponse.json({ error: "voice_id es obligatorio" }, { status: 400 });
  }

  try {
    const provider = await getTtsProvider();
    // Same persona the finished narration will use — otherwise the sample is
    // not a preview of anything.
    const settings = await loadSettings(auth.admin);
    const result = await provider.synthesize({
      text: SAMPLE_TEXT,
      voiceId,
      style: typeof body.style === "string" ? body.style : settings.voice_style,
    });

    const wav = pcmToWav(result.pcm, {
      sampleRate: result.sampleRate,
      channels: result.channels,
    });

    return new NextResponse(new Uint8Array(wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
